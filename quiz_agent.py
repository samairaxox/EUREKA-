from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json, re

load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)

def safe_parse(content: str):
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]).strip()
    return json.loads(clean)

def quiz_agent(topic: str, num_questions: int = 5) -> list:
    prompt = PromptTemplate.from_template(
        "Generate exactly {num_questions} multiple choice questions about: {topic}\n\n"
        "Return ONLY a JSON array with exactly {num_questions} objects.\n"
        "Each object must have exactly these keys:\n"
        "  question: the question string\n"
        "  options: array of exactly 4 answer strings\n"
        "  answer: the correct answer string (must match one of the options exactly)\n\n"
        "Rules:\n"
        "- No extra text before or after the JSON\n"
        "- No markdown formatting\n"
        "- Just raw JSON array, nothing else"
    )
    chain = prompt | llm
    result = chain.invoke({"topic": topic, "num_questions": num_questions})
    return safe_parse(result.content)