from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents import summarizer_agent, planner_agent
from eureka_graph import app_graph
import fitz  # pymupdf
import io
import uuid

# ── In-memory vectorstore store (session_id → vectorstore) ──
_rag_store: dict = {}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

# ── PDF extraction helper ───────────────────────
def extract_pdf_text(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()

# ── Endpoints ───────────────────────────────────
@app.get("/")
def root():
    return {"status": "Study Assistant API is running"}

@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        text = extract_pdf_text(contents)
        if not text:
            return {"error": "Could not extract text from this PDF. It may be scanned or image-based."}
        return {"text": text, "pages": len(text.split("\n"))}
    except Exception as e:
        print(f"PDF ERROR: {e}")
        raise

@app.post("/summarize")
def summarize(req: SummaryRequest):
    try:
        result = summarizer_agent(req.text)
        if isinstance(result, dict):
            return result
        return {"summary": result, "key_points": []}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

@app.post("/plan")
def plan(req: PlanRequest):
    try:
        result = planner_agent(req.topic, req.exam_date, req.start_date)
        return {"schedule": result}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

@app.post("/quiz")
def quiz(req: QuizRequest):
    try:
        result = app_graph.invoke({
            "user_input": "quiz",
            "topic": req.topic,
            "num_questions": req.num_questions,
            "agent_type": "",
            "result": None
        })
        return {"questions": result["result"]}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

@app.post("/flashcards")
def flashcards(req: FlashcardRequest):
    try:
        result = app_graph.invoke({
            "user_input": "flashcards",
            "topic": req.topic,
            "num_cards": req.num_cards,
            "agent_type": "",
            "result": None
        })
        return {"cards": result["result"]}
    except Exception as e:
        print(f"ERROR: {e}")
        raise

# ── RAG request models ───────────────────────────
class RagQuizRequest(BaseModel):
    session_id: str
    num_questions: int = 5

class RagSummarizeRequest(BaseModel):
    session_id: str

class RagFlashcardsRequest(BaseModel):
    session_id: str
    num_cards: int = 10

class RagPlanRequest(BaseModel):
    session_id: str
    exam_date: str

# ── RAG endpoints ────────────────────────────────
@app.post("/rag/upload")
async def rag_upload(file: UploadFile = File(...)):
    """Upload a PDF, build a FAISS vectorstore, return a session_id."""
    try:
        # Keep the base API available even if optional embedding dependencies
        # (or their native model runtime) cannot initialize on this machine.
        from rag_engine import build_vectorstore

        pdf_bytes = await file.read()
        vectorstore = build_vectorstore(pdf_bytes)
        session_id = str(uuid.uuid4())
        _rag_store[session_id] = vectorstore
        return {"session_id": session_id, "filename": file.filename}
    except Exception as e:
        print(f"RAG UPLOAD ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/quiz")
def rag_quiz(req: RagQuizRequest):
    """Generate an MCQ quiz from a previously uploaded PDF."""
    vectorstore = _rag_store.get(req.session_id)
    if not vectorstore:
        raise HTTPException(status_code=404, detail="session_id not found. Upload a PDF first via /rag/upload.")
    try:
        from rag_engine import rag_query

        prompt = (
            f"Generate {req.num_questions} multiple-choice questions (MCQs) from the document content. "
            "For each question provide 4 options labelled A–D and mark the correct answer. "
            "Format each question clearly and number them."
        )
        result = rag_query(vectorstore, prompt)
        return {"session_id": req.session_id, "num_questions": req.num_questions, "quiz": result}
    except Exception as e:
        print(f"RAG QUIZ ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/summarize")
def rag_summarize(req: RagSummarizeRequest):
    """Generate a structured summary from a previously uploaded PDF."""
    vectorstore = _rag_store.get(req.session_id)
    if not vectorstore:
        raise HTTPException(status_code=404, detail="session_id not found. Upload a PDF first via /rag/upload.")
    try:
        from rag_engine import rag_query

        prompt = (
            "Provide a clear, structured summary of the document. "
            "Include: main topic, key points (as bullet points), and a brief conclusion."
        )
        result = rag_query(vectorstore, prompt)
        return {"session_id": req.session_id, "summary": result}
    except Exception as e:
        print(f"RAG SUMMARIZE ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/flashcards")
def rag_flashcards(req: RagFlashcardsRequest):
    """Generate flashcards from a previously uploaded PDF."""
    vectorstore = _rag_store.get(req.session_id)
    if not vectorstore:
        raise HTTPException(status_code=404, detail="session_id not found. Upload a PDF first via /rag/upload.")
    try:
        from rag_engine import rag_query

        prompt = (
            f"Create {req.num_cards} study flashcards from the document content. "
            "For each card, clearly label the front as 'Front:' with a concise term or question, "
            "and the back as 'Back:' with its definition or answer. Number every card."
        )
        result = rag_query(vectorstore, prompt)
        return {"session_id": req.session_id, "num_cards": req.num_cards, "flashcards": result}
    except Exception as e:
        print(f"RAG FLASHCARDS ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/plan")
def rag_plan(req: RagPlanRequest):
    """Generate a study plan from a previously uploaded PDF and exam date."""
    vectorstore = _rag_store.get(req.session_id)
    if not vectorstore:
        raise HTTPException(status_code=404, detail="session_id not found. Upload a PDF first via /rag/upload.")
    try:
        from rag_engine import rag_query

        prompt = (
            f"Create a practical study plan based on the document content, ending on the exam date {req.exam_date}. "
            "Organize the plan chronologically from today through the exam date. "
            "Break the material into focused sessions, include review and practice, and clearly label each date or day."
        )
        result = rag_query(vectorstore, prompt)
        return {"session_id": req.session_id, "exam_date": req.exam_date, "study_plan": result}
    except Exception as e:
        print(f"RAG PLAN ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))
