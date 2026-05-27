from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json
import re

load_dotenv()

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.5)


def safe_parse(content: str):
    # Remove markdown code fences if present
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        # Remove first line (```json or ```) and last line (```)
        clean = "\n".join(lines[1:-1]).strip()
    return json.loads(clean)

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
