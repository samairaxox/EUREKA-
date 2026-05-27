from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents import summarizer_agent, planner_agent
from eureka_graph import app_graph
import fitz  # pymupdf
import io

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