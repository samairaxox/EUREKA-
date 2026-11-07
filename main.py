from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
import logging
import hashlib
import os
import tempfile
import time
from datetime import datetime, timezone
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from agents import summarizer_agent, planner_agent
from eureka_graph import app_graph
import uuid

from config import settings
from migrations import upgrade_to_head
from database import Base, engine, get_db
from deps import get_current_user
from models import User
from rate_limit import enforce
from auth_routes import router as auth_router
from progress_routes import local_today, record_activity, router as progress_router
from workspace_routes import router as workspace_router
from streak_logic import compute_streaks  # noqa: F401  (re-exported for tooling)
from document_processing import DocumentProcessingError, extract_pdf_text

# ── In-memory RAG store: session_id → {owner_id, vectorstore} ──
# Sessions are bound to the user who uploaded the PDF. They are lost on restart.
_rag_store: dict = {}
_rag_dedup: dict = {}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="EUREKA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Local-Date"],
)

app.include_router(auth_router)
app.include_router(progress_router)
app.include_router(workspace_router)


@app.on_event("startup")
def _prepare_database() -> None:
    """Bring the schema up to date before serving. Failure stops startup instead of serving bad data."""
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        return
    if settings.auto_migrate:
        upgrade_to_head()


@app.exception_handler(ProgrammingError)
async def _database_schema_error(request, exc: ProgrammingError):
    # A missing table means the migrations have not been applied. Say so, and say how to fix it.
    message = str(getattr(exc, "orig", exc))
    if "does not exist" in message:
        logger.error("Database schema is behind the code: %s", message.splitlines()[0])
        return JSONResponse(
            status_code=503,
            content={"detail": "The database is missing tables for this version of EUREKA. "
                               "Run 'alembic upgrade head', or start the API with AUTO_MIGRATE=true."},
        )
    logger.exception("Database error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "A database error occurred. Please try again."})


@app.get("/health")
def health():
    """Reports whether the database answers and whether its migrations match this code."""
    from migrations import current_revision, head_revision
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        database = "unreachable"
    current = current_revision() if database == "ok" else None
    head = head_revision()
    return {
        "database": database,
        "schema_revision": current,
        "expected_revision": head,
        "schema_up_to_date": database == "ok" and current == head,
    }

# ── Request models ──────────────────────────────
class SummaryRequest(BaseModel):
    text: str

class PlanRequest(BaseModel):
    topic: str
    exam_date: str
    start_date: str = ""

class QuizRequest(BaseModel):
    topic: str
    num_questions: int = 5

class FlashcardRequest(BaseModel):
    topic: str
    num_cards: int = 10

# ── PDF extraction helper remains page-aware in document_processing.py ──

def _ai_guard(request: Request) -> None:
    enforce(request, "ai", settings.rate_limit_ai_per_minute)

# ── Endpoints ───────────────────────────────────
@app.get("/")
def root():
    return {"status": "Study Assistant API is running"}

@app.post("/extract-pdf")
async def extract_pdf(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    _ai_guard(request)
    try:
        max_bytes = int(os.getenv("MAX_PDF_BYTES", str(30 * 1024 * 1024)))
        contents = await file.read(max_bytes + 1)
        if len(contents) > max_bytes:
            return {"error": f"PDF must be no larger than {max_bytes // (1024 * 1024)} MB."}
        text, page_count = await run_in_threadpool(extract_pdf_text, contents)
        return {"text": text, "pages": page_count}
    except DocumentProcessingError as exc:
        return {"error": str(exc)}
    except Exception:
        logger.exception("PDF text extraction failed")
        return {"error": "The PDF could not be processed. Check that it is a valid, unlocked PDF."}

@app.post("/summarize")
def summarize(req: SummaryRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db),
              ):
    _ai_guard(request)
    try:
        result = summarizer_agent(req.text)
        record_activity(db, user, "summary", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        if isinstance(result, dict):
            return result
        return {"summary": result, "key_points": []}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("Summary generation failed")
        raise HTTPException(status_code=502, detail="The summary could not be generated. Please try again shortly.")

@app.post("/plan")
def plan(req: PlanRequest, request: Request, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    request_id = uuid.uuid4().hex
    response.headers["X-Request-ID"] = request_id
    logger.info("AI request started agent=planner request_id=%s", request_id)
    try:
        _ai_guard(request)
        result = planner_agent(req.topic, req.exam_date, req.start_date, request_id=request_id)
        record_activity(db, user, "plan", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"schedule": result}
    except HTTPException as exc:
        logger.warning("AI request failed agent=planner request_id=%s status=%d error_type=HTTPException",
                       request_id, exc.status_code)
        raise
    except ValueError as exc:
        db.rollback()
        logger.error("AI request failed agent=planner request_id=%s status=502 error_type=%s",
                     request_id, type(exc).__name__)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        provider_status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
        logger.error("AI request failed agent=planner request_id=%s status=502 error_type=%s provider_status=%s",
                     request_id, type(exc).__name__, provider_status)
        raise HTTPException(status_code=502, detail="The schedule could not be generated. Please try again shortly.")

@app.post("/quiz")
def quiz(req: QuizRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ai_guard(request)
    try:
        result = app_graph.invoke({
            "user_input": "quiz",
            "topic": req.topic,
            "num_questions": req.num_questions,
            "agent_type": "",
            "result": None
        })
        record_activity(db, user, "quiz_generated", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"questions": result["result"]}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

@app.post("/flashcards")
def flashcards(req: FlashcardRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _ai_guard(request)
    try:
        result = app_graph.invoke({
            "user_input": "flashcards",
            "topic": req.topic,
            "num_cards": req.num_cards,
            "agent_type": "",
            "result": None
        })
        record_activity(db, user, "flashcards", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"cards": result["result"]}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

# ── RAG request models ───────────────────────────
class RagQuizRequest(BaseModel):
    session_id: str
    num_questions: int = Field(default=5, ge=1, le=20)

class RagSummarizeRequest(BaseModel):
    session_id: str

class RagFlashcardsRequest(BaseModel):
    session_id: str
    num_cards: int = Field(default=10, ge=1, le=30)

class RagPlanRequest(BaseModel):
    session_id: str
    exam_date: str
    start_date: str = ""

class RagAskRequest(BaseModel):
    session_id: str
    question: str = Field(min_length=1, max_length=2000)

# ── RAG helpers ──────────────────────────────────
def _owned_vectorstore(session_id: str, user: User):
    _purge_expired_rag_sessions()
    entry = _rag_store.get(session_id)
    # Same message for "missing" and "owned by someone else" so session IDs cannot be probed.
    if not entry or entry["owner_id"] != user.id:
        raise HTTPException(status_code=404, detail="session_id not found. Upload a PDF first via /rag/upload.")
    return entry["vectorstore"]


def _purge_expired_rag_sessions(now: float | None = None) -> None:
    """Release abandoned FAISS indexes on subsequent PDF activity; sessions are process-local."""
    current = now if now is not None else time.time()
    ttl = max(60, int(os.getenv("RAG_SESSION_TTL_SECONDS", "3600")))
    for session_id, entry in list(_rag_store.items()):
        if current - entry.get("created_at", current) > ttl:
            _rag_store.pop(session_id, None)
            _rag_dedup.pop((str(entry.get("owner_id")), entry.get("content_hash")), None)

# ── RAG endpoints ────────────────────────────────
@app.post("/rag/upload")
async def rag_upload(request: Request, file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Stream an upload to a temporary file, build a FAISS index, and return its owned session."""
    _ai_guard(request)
    temporary_path = None
    try:
        from rag_engine import MAX_PDF_BYTES, build_vectorstore, _documents

        _purge_expired_rag_sessions()

        if file.filename and not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=415, detail="Only PDF files are supported.")
        digest = hashlib.sha256()
        size = 0
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as staged:
            temporary_path = staged.name
            while True:
                part = await file.read(1024 * 1024)
                if not part:
                    break
                size += len(part)
                if size > MAX_PDF_BYTES:
                    raise HTTPException(status_code=413, detail=f"PDF must be no larger than {MAX_PDF_BYTES // (1024 * 1024)} MB.")
                digest.update(part)
                staged.write(part)
        if size < 1:
            raise HTTPException(status_code=400, detail="The uploaded PDF is empty.")
        dedup_key = (str(user.id), digest.hexdigest())
        existing_id = _rag_dedup.get(dedup_key)
        if existing_id and existing_id in _rag_store:
            return {"session_id": existing_id, "filename": file.filename, "status": "ready"}
        session_id = str(uuid.uuid4())
        vectorstore = await run_in_threadpool(build_vectorstore,
            temporary_path, document_id=session_id, filename=file.filename or "document.pdf",
            owner_id=user.id, uploaded_at=datetime.now(timezone.utc).isoformat(),
        )
        document_chunks = _documents(vectorstore)
        page_count = max((int(doc.metadata.get("total_pages", 0)) for doc in document_chunks), default=0)
        now = time.time()
        max_sessions = max(1, int(os.getenv("RAG_MAX_SESSIONS", "8")))
        while len(_rag_store) >= max_sessions:
            oldest_id = min(_rag_store, key=lambda key: _rag_store[key].get("created_at", 0))
            old = _rag_store.pop(oldest_id)
            _rag_dedup.pop((str(old.get("owner_id")), old.get("content_hash")), None)
        _rag_store[session_id] = {
            "owner_id": user.id, "vectorstore": vectorstore, "document_id": session_id,
            "filename": file.filename or "document.pdf", "content_hash": digest.hexdigest(),
            "created_at": now, "page_count": page_count, "chunk_count": len(document_chunks),
        }
        _rag_dedup[dedup_key] = session_id
        return {"session_id": session_id, "filename": file.filename, "status": "ready", "pages": page_count, "chunks": len(document_chunks)}
    except HTTPException:
        raise
    except DocumentProcessingError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("PDF indexing failed")
        raise HTTPException(status_code=503, detail="The PDF could not be indexed. Check the embedding setup and try again.")
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except OSError:
                logger.warning("Could not remove a temporary PDF upload file")

@app.post("/rag/quiz")
def rag_quiz(req: RagQuizRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate an MCQ quiz from a previously uploaded PDF."""
    _ai_guard(request)
    vectorstore = _owned_vectorstore(req.session_id, user)
    try:
        from rag_engine import generate_quiz
        result = generate_quiz(vectorstore, req.num_questions)
        record_activity(db, user, "rag_quiz", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"session_id": req.session_id, "num_questions": req.num_questions, "quiz": result}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("RAG quiz generation failed")
        raise HTTPException(status_code=502, detail="The PDF quiz could not be generated. Please try again shortly.")

@app.post("/rag/summarize")
def rag_summarize(req: RagSummarizeRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a structured summary from a previously uploaded PDF."""
    _ai_guard(request)
    vectorstore = _owned_vectorstore(req.session_id, user)
    try:
        from rag_engine import summarize_document
        result = summarize_document(vectorstore)
        record_activity(db, user, "rag_summary", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"session_id": req.session_id, "summary": result}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("RAG summary generation failed")
        raise HTTPException(status_code=502, detail="The PDF summary could not be generated. Please try again shortly.")

@app.post("/rag/flashcards")
def rag_flashcards(req: RagFlashcardsRequest, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate flashcards from a previously uploaded PDF."""
    _ai_guard(request)
    vectorstore = _owned_vectorstore(req.session_id, user)
    try:
        from rag_engine import generate_flashcards
        result = generate_flashcards(vectorstore, req.num_cards)
        record_activity(db, user, "rag_flashcards", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"session_id": req.session_id, "num_cards": req.num_cards, "flashcards": result}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("RAG flashcard generation failed")
        raise HTTPException(status_code=502, detail="PDF flashcards could not be generated. Please try again shortly.")

@app.post("/rag/plan")
def rag_plan(req: RagPlanRequest, request: Request, response: Response, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Generate a date-wise plan from every page-aware chunk in the owned FAISS index."""
    _ai_guard(request)
    vectorstore = _owned_vectorstore(req.session_id, user)
    request_id = uuid.uuid4().hex
    response.headers["X-Request-ID"] = request_id
    start_date = req.start_date or local_today(request.headers.get("X-Local-Date")).isoformat()
    logger.info("AI request started agent=rag_planner request_id=%s session_id=%s", request_id, req.session_id)
    try:
        from rag_engine import generate_document_plan
        schedule = generate_document_plan(vectorstore, start_date, req.exam_date, request_id=request_id)
        result = "\n\n".join(
            f"{row['day']} · {row['date']} · {row['task']} ({row['duration']})"
            for row in schedule
        )
        record_activity(db, user, "rag_plan", local_today(request.headers.get("X-Local-Date")))
        db.commit()
        return {"session_id": req.session_id, "start_date": start_date, "exam_date": req.exam_date,
                "study_plan": result, "schedule": schedule}
    except RuntimeError as exc:
        db.rollback()
        logger.error("AI request failed agent=rag_planner request_id=%s status=503 error_type=%s",
                     request_id, type(exc).__name__)
        raise HTTPException(status_code=503, detail=str(exc), headers={"X-Request-ID": request_id}) from exc
    except ValueError as exc:
        db.rollback()
        logger.error("AI request failed agent=rag_planner request_id=%s status=422 error_type=%s",
                     request_id, type(exc).__name__)
        raise HTTPException(status_code=422, detail=str(exc), headers={"X-Request-ID": request_id}) from exc
    except Exception as exc:
        db.rollback()
        logger.error("AI request failed agent=rag_planner request_id=%s status=502 error_type=%s",
                     request_id, type(exc).__name__)
        raise HTTPException(status_code=502, detail="The PDF study plan could not be generated. Please try again shortly.",
                            headers={"X-Request-ID": request_id})

@app.post("/rag/ask")
def rag_ask(req: RagAskRequest, request: Request, user: User = Depends(get_current_user)):
    """Answer a question using only relevant, budgeted chunks from this user's PDF session."""
    _ai_guard(request)
    question = req.question.strip()
    if not question or len(question) > 2000:
        raise HTTPException(status_code=422, detail="Question must contain 1–2,000 characters.")
    vectorstore = _owned_vectorstore(req.session_id, user)
    try:
        from rag_engine import rag_query
        return {"session_id": req.session_id, "answer": rag_query(vectorstore, question)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        logger.exception("RAG question answering failed")
        raise HTTPException(status_code=502, detail="The PDF could not answer this question right now. Please try again shortly.")
