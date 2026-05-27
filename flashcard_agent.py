from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
import json

load_dotenv()
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.7)

def safe_parse(content: str):
    clean = content.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]).strip()
    return json.loads(clean)

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