from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json, os

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

def flashcard_agent(topic: str, num_cards: int = 10) -> list:
    prompt = PromptTemplate.from_template(
        "Generate exactly {num_cards} flashcards about: {topic}\n\n"
        "Return ONLY a JSON array with exactly {num_cards} objects.\n"
        "Each object must have exactly these keys:\n"
        "  front: a term, concept, or question (keep it short)\n"
        "  back: the definition or answer (1-2 sentences max)\n\n"
        "Rules:\n"
        "- No extra text before or after the JSON\n"
        "- No markdown formatting\n"
        "- Just raw JSON array, nothing else"
    )
    chain = prompt | llm
    result = chain.invoke({"topic": topic, "num_cards": num_cards})
    return safe_parse(result.content)