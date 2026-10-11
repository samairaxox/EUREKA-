from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json, re, os

load_dotenv()
llm = ChatGroq(model="openai/gpt-oss-20b", temperature=0.7, groq_api_key=os.getenv("GROQ_API_KEY"))

def safe_parse(content: str):
    """Parse LLM JSON output, using json_repair as a fallback for malformed responses."""
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        try:
            from json_repair import repair_json
            repaired = repair_json(clean)
            return json.loads(repaired)
        except Exception as e:
            print(f"[safe_parse] Could not repair JSON: {e}\nRaw content: {content[:500]}")
            raise

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