from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json
import re
import os

load_dotenv()

llm = ChatGroq(model="openai/gpt-oss-20b", temperature=0.5, groq_api_key=os.getenv("GROQ_API_KEY"))


def safe_parse(content: str):
    """Parse LLM JSON output, using json_repair as a fallback for malformed responses."""
    clean = content.strip()
    # Remove markdown code fences if present
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Attempt to repair and re-parse
        try:
            from json_repair import repair_json
            repaired = repair_json(clean)
            return json.loads(repaired)
        except Exception as e:
            print(f"[safe_parse] Could not repair JSON: {e}\nRaw content: {content[:500]}")
            raise

def summarizer_agent(text: str) -> dict:
    prompt = PromptTemplate.from_template(
        "Summarize the following study notes: {text}\n\n"
        "Return ONLY a JSON object with exactly these two keys:\n"
        "summary: one short paragraph, maximum 4 sentences\n"
        "key_points: a list of exactly 5 bullet points as strings\n\n"
        "Rules:\n"
        "- No extra text before or after the JSON\n"
        "- No markdown formatting\n"
        "- Just raw JSON, nothing else"
    )
    chain = prompt | llm
    result = chain.invoke({"text": text})
    return safe_parse(result.content)


def planner_agent(topic: str, exam_date: str, start_date: str = "") -> list:
    prompt = PromptTemplate.from_template(
        "Create a study plan for this topic: {topic}\n"
        "Study starts on: {start_date}\n"
        "Exam is on: {exam_date}\n\n"
        "STRICT RULES:\n"
        "- Only generate days FROM {start_date} UP TO AND INCLUDING {exam_date}\n"
        "- Do NOT generate any days after the exam date\n"
        "- The last day in the plan must be {exam_date} (exam day - light revision only)\n"
        "- Count the exact number of days between start and exam, generate exactly that many entries\n\n"
        "Return ONLY a JSON array. Each object must have exactly these keys:\n"
        "day: string like 'Day 1'\n"
        "date: actual calendar date in YYYY-MM-DD format\n"
        "task: string describing what to study\n"
        "duration: string like '2 hours'\n\n"
        "Return raw JSON only. No markdown, no extra text."
    )
    chain = prompt | llm
    result = chain.invoke({"topic": topic, "exam_date": exam_date, "start_date": start_date})
    return safe_parse(result.content)
