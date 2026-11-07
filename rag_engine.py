"""Page-aware FAISS ingestion and token-bounded Groq generation for PDF Study."""
from __future__ import annotations

import json
import logging
import math
import os
import random
import re
from difflib import SequenceMatcher
import threading
import time
from email.utils import parsedate_to_datetime
from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv
from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings

from document_processing import DocumentProcessingError, extract_pdf_chunks
from llm_runtime import LLM_GATE

load_dotenv()
logger = logging.getLogger(__name__)

# The original model, local HuggingFace embeddings, and FAISS remain in use.
MODEL_NAME = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
CONTEXT_TOKEN_BUDGET = max(500, int(os.getenv("RAG_CONTEXT_TOKEN_BUDGET", "2400")))
OUTPUT_TOKEN_BUDGET = max(128, int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "700")))
PROMPT_TOKEN_RESERVE = max(300, int(os.getenv("RAG_PROMPT_TOKEN_RESERVE", "700")))
MAX_RETRIEVED_CHUNKS = max(1, int(os.getenv("RAG_MAX_RETRIEVED_CHUNKS", "8")))
MAX_DOCUMENT_CHUNKS = max(1, int(os.getenv("RAG_MAX_DOCUMENT_CHUNKS", "160")))
MAX_PLAN_DAYS = max(1, int(os.getenv("RAG_PLAN_MAX_DAYS", "120")))
MAX_PDF_BYTES = max(1, int(os.getenv("MAX_PDF_BYTES", str(30 * 1024 * 1024))))
_embedding_gate = threading.BoundedSemaphore(max(1, int(os.getenv("RAG_MAX_CONCURRENT_EMBEDDINGS", "1"))))
RETRY_COUNT = max(0, min(4, int(os.getenv("GROQ_RETRY_COUNT", "2"))))
MAX_RETRY_WAIT_SECONDS = max(1, int(os.getenv("GROQ_MAX_RETRY_WAIT_SECONDS", "120")))

llm = ChatGroq(
    model=MODEL_NAME,
    temperature=0.2,
    groq_api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=OUTPUT_TOKEN_BUDGET,
    # Structured planning needs the completion budget for JSON, not long internal reasoning.
    reasoning_effort=os.getenv("GROQ_REASONING_EFFORT", "low"),
    timeout=float(os.getenv("GROQ_TIMEOUT_SECONDS", "60")),
    max_retries=0,  # retries below are status-aware; never repeat an oversized request unchanged
)
embeddings = None  # Lazy to keep non-RAG endpoints usable without the native embedding runtime.


class GroqRequestError(RuntimeError):
    """Provider error with a safe message suitable for the API response."""


def _embedding_model():
    global embeddings
    if embeddings is None:
        embeddings = HuggingFaceEmbeddings(
            model_name=os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
            model_kwargs={"device": os.getenv("EMBEDDING_DEVICE", "cpu")},
            encode_kwargs={"batch_size": int(os.getenv("EMBEDDING_BATCH_SIZE", "32"))},
        )
    return embeddings


def _status_code(exc):
    value = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _retry_after(exc):
    headers = getattr(getattr(exc, "response", None), "headers", {}) or {}
    value = headers.get("retry-after") or headers.get("Retry-After")
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        try:
            target = parsedate_to_datetime(value).timestamp()
            return max(0.0, target - time.time())
        except (TypeError, ValueError, OverflowError):
            return None


def _is_oversized(exc):
    message = str(exc).lower()
    return _status_code(exc) == 413 or any(term in message for term in ("request too large", "prompt is too long", "token limit", "context length"))


def _is_rate_limited(exc):
    return _status_code(exc) == 429 or "rate limit" in str(exc).lower() or "too many requests" in str(exc).lower()


def _is_transient(exc):
    status = _status_code(exc)
    return status in (408, 425, 500, 502, 503, 504) or isinstance(exc, (TimeoutError, ConnectionError))


def estimate_tokens(text: str) -> int:
    """Conservative fallback without adding a tokenizer dependency (3 chars/token)."""
    return math.ceil(len(text or "") / 3)


def _limited_context(text: str, budget: int) -> str:
    # At least one character per token estimate; retaining the beginning preserves the most relevant ranked evidence.
    return (text or "")[: max(0, budget) * 3]


def _call(prompt: str, *, context: str = "", prompt_factory=None, output_tokens: int | None = None,
          return_context: bool = False, agent_name: str = "rag", request_id: str | None = None,
          stage: str = "generation"):
    """Serialize provider calls, bound prompt size, and retry transient errors safely."""
    budget = CONTEXT_TOKEN_BUDGET
    context = _limited_context(context, budget)
    for attempt in range(RETRY_COUNT + 1):
        if request_id:
            logger.info("AI call started agent=%s request_id=%s stage=%s attempt=%d",
                        agent_name, request_id, stage, attempt + 1)
        current_prompt = prompt_factory(context) if prompt_factory else prompt
        # Keep prompt instructions + context + expected output below a conservative request envelope.
        estimate = estimate_tokens(current_prompt) + min(OUTPUT_TOKEN_BUDGET, output_tokens or OUTPUT_TOKEN_BUDGET)
        if estimate > CONTEXT_TOKEN_BUDGET + PROMPT_TOKEN_RESERVE + OUTPUT_TOKEN_BUDGET:
            allowed_context = max(0, CONTEXT_TOKEN_BUDGET - estimate_tokens(current_prompt.replace(context, "")))
            context = _limited_context(context, allowed_context)
            current_prompt = prompt_factory(context) if prompt_factory else current_prompt
        try:
            with LLM_GATE:
                result = llm.invoke(current_prompt)
            content = getattr(result, "content", result)
            if isinstance(content, list):
                content = "".join(str(part.get("text", "")) if isinstance(part, dict) else str(part) for part in content)
            response = str(content).strip()
            if request_id:
                metadata = getattr(result, "response_metadata", {}) or {}
                usage = metadata.get("token_usage") or {}
                logger.info(
                    "AI response received agent=%s request_id=%s stage=%s empty=%s finish_reason=%s completion_tokens=%s",
                    agent_name, request_id, stage, not bool(response), metadata.get("finish_reason"),
                    usage.get("completion_tokens"),
                )
            return (response, context) if return_context else response
        except Exception as exc:
            if request_id:
                logger.warning("AI call failed agent=%s request_id=%s stage=%s attempt=%d error_type=%s provider_status=%s",
                               agent_name, request_id, stage, attempt + 1, type(exc).__name__, _status_code(exc))
            if _is_oversized(exc):
                if not context or len(context) < 600:
                    raise GroqRequestError(
                        "The AI provider rejected a request as too large even after applying the document token budget. Try a smaller PDF or a shorter request."
                    ) from exc
                # Shrink context and rebuild the prompt; never resend the same oversized request.
                context = context[: max(300, len(context) // 2)]
                continue
            if (_is_rate_limited(exc) or _is_transient(exc)) and attempt < RETRY_COUNT:
                delay = _retry_after(exc)
                if delay is None:
                    delay = min(8.0, 0.5 * (2 ** attempt)) + random.uniform(0.05, 0.35)
                elif delay > MAX_RETRY_WAIT_SECONDS:
                    raise GroqRequestError("Groq requested a longer rate-limit wait than this request allows. Wait for the provider reset, then try again.") from exc
                time.sleep(delay)
                continue
            if _is_rate_limited(exc):
                raise GroqRequestError("Groq is temporarily rate-limited. Wait briefly, then try again.") from exc
            raise GroqRequestError("The AI provider could not complete this request. Please try again shortly.") from exc
    raise GroqRequestError("The AI provider could not complete this request after a bounded retry.")


def _documents(vectorstore) -> list[Document]:
    """Read all FAISS documents without relying on private ordering where possible."""
    docstore = getattr(vectorstore, "docstore", None)
    mapping = getattr(vectorstore, "index_to_docstore_id", None) or {}
    docs = []
    for index in sorted(mapping):
        if not docstore:
            found = None
        elif hasattr(docstore, "search"):
            found = docstore.search(mapping[index])
        else:
            found = getattr(docstore, "_dict", {}).get(mapping[index])
        if isinstance(found, Document):
            docs.append(found)
    if not docs and docstore and hasattr(docstore, "_dict"):
        docs = [item for item in docstore._dict.values() if isinstance(item, Document)]
    docs.sort(key=lambda doc: (int(doc.metadata.get("chunk_index", 0)), int(doc.metadata.get("page", 0))))
    return docs


def build_vectorstore(pdf_bytes: bytes | bytearray | str, *, document_id: str = "", filename: str = "", owner_id=None, uploaded_at: str = ""):
    """Build the existing FAISS index from page-aware chunks; fail clearly for scanned/corrupt files."""
    size = len(pdf_bytes) if isinstance(pdf_bytes, (bytes, bytearray)) else os.path.getsize(pdf_bytes)
    if not size or size > MAX_PDF_BYTES:
        raise DocumentProcessingError(f"PDF must be between 1 byte and {MAX_PDF_BYTES // (1024 * 1024)} MB.")
    chunks, _total_pages = extract_pdf_chunks(
        pdf_bytes, document_id=document_id, filename=filename, owner_id=owner_id,
        uploaded_at=uploaded_at or datetime.now(timezone.utc).isoformat(), max_chunks=MAX_DOCUMENT_CHUNKS,
    )
    try:
        with _embedding_gate:
            return FAISS.from_documents(chunks, _embedding_model())
    except Exception as exc:
        logger.exception("Embedding/index creation failed for document %s", document_id or "unknown")
        raise RuntimeError("Could not create the PDF search index. Check the local embedding model and try again.") from exc


def _page_label(doc: Document) -> str:
    page = doc.metadata.get("page") or doc.metadata.get("page_start")
    return f"[Page {page}] " if page else ""


def retrieve_context(vectorstore, question: str, *, token_budget: int | None = None, max_chunks: int | None = None) -> tuple[str, list[int]]:
    count = max(1, max_chunks or MAX_RETRIEVED_CHUNKS)
    budget = max(100, token_budget or CONTEXT_TOKEN_BUDGET)
    try:
        docs = vectorstore.similarity_search(question, k=count)
    except Exception as exc:
        logger.exception("FAISS retrieval failed")
        raise GroqRequestError("Could not search this PDF. Please upload it again and retry.") from exc
    pieces, pages, used = [], [], 0
    for doc in docs:
        page = doc.metadata.get("page")
        piece = f"{_page_label(doc)}{doc.page_content.strip()}"
        remaining = budget - used
        if remaining <= 0:
            break
        piece = _limited_context(piece, remaining)
        if not piece.strip():
            continue
        pieces.append(piece)
        used += estimate_tokens(piece)
        if page is not None:
            pages.append(int(page))
    return "\n\n".join(pieces), sorted(set(pages))


def rag_query(vectorstore, prompt: str) -> str:
    """Retrieve only relevant, budgeted chunks and answer with page citations."""
    context, _pages = retrieve_context(vectorstore, prompt)
    if not context.strip():
        return "The uploaded PDF does not contain enough extractable text to answer this request."
    factory = lambda ctx: (
        "Answer the user's request using only the evidence below. If the evidence does not contain the answer, "
        "say that the PDF does not provide enough information. Do not guess. Cite supporting page numbers in the answer.\n\n"
        f"Evidence:\n{ctx}\n\nRequest: {prompt}\nAnswer:"
    )
    pending = [context]
    answers = []
    while pending:
        current = pending.pop(0)
        answer, used_context = _call("", context=current, prompt_factory=factory, output_tokens=600, return_context=True)
        pages_used = sorted({int(page) for page in re.findall(r"\[Page (\d+)\]", used_context)})
        citations = ", ".join(f"p. {page}" for page in pages_used)
        if citations and "page" not in answer.lower() and "p." not in answer.lower():
            answer = f"{answer}\n\nSources: {citations}."
        answers.append(answer)
        if len(used_context) + 100 < len(current):
            pending.insert(0, current[max(0, len(used_context) - 100):])
        if len(pending) + len(answers) > MAX_RETRIEVED_CHUNKS * 4:
            raise GroqRequestError("The complete retrieved evidence could not be processed within the request limit. Please retry shortly.")
    return "\n\n".join(answers)


def _balanced_groups(docs: list[Document], max_chars: int) -> list[str]:
    groups = []
    current = []
    size = 0
    for doc in docs:
        piece = f"{_page_label(doc)}{doc.page_content.strip()}"
        if current and size + len(piece) > max_chars:
            groups.append("\n\n".join(current))
            current, size = [], 0
        if len(piece) > max_chars:
            # Split unusually long legacy chunks while retaining the same page citation.
            step = max(300, max_chars - 300)
            for pos in range(0, len(piece), step):
                if current:
                    groups.append("\n\n".join(current))
                    current, size = [], 0
                part = piece[pos:pos + step].strip()
                if part:
                    groups.append(part)
            continue
        current.append(piece)
        size += len(piece)
    if current:
        groups.append("\n\n".join(current))
    return groups


def _run_all_groups(groups: list[str], task: str, *, chunk_output: int = 350) -> list[str]:
    if len(groups) > MAX_DOCUMENT_CHUNKS:
        raise GroqRequestError(
            f"This request requires {len(groups)} document sections, above the synchronous processing limit. Split the PDF and retry."
        )
    outputs = []
    pending = list(groups)
    index = 0
    while index < len(pending):
        group = pending[index]
        factory = lambda ctx, i=index + 1: (
            f"{task}\nThis is document section {i}. Use only its supplied evidence. Preserve any page references. "
            f"Be concise and do not invent facts.\n\nEvidence:\n{ctx}\n\nOutput:"
        )
        try:
            output, used_context = _call("", context=group, prompt_factory=factory, output_tokens=chunk_output, return_context=True)
            outputs.append(output)
            if len(used_context) + 100 < len(group):
                # A 413 caused a smaller prompt. Queue the unsent tail as another stage so coverage is retained.
                tail = group[max(0, len(used_context) - 100):]
                if tail.strip():
                    pending.insert(index + 1, tail)
                    if len(pending) > MAX_DOCUMENT_CHUNKS * 4:
                        raise GroqRequestError("Adaptive PDF processing exceeded its section limit. Split the PDF and retry.")
        except Exception as exc:
            raise GroqRequestError(f"Processing stopped at document section {index + 1}. No complete result was returned. {exc}") from exc
        index += 1
    return outputs


def summarize_document(vectorstore) -> str:
    """Hierarchical map/reduce over all indexed chunks, not a top-k retrieval summary."""
    docs = _documents(vectorstore)
    if not docs:
        raise GroqRequestError("This PDF has no indexed text to summarize.")
    groups = _balanced_groups(docs, CONTEXT_TOKEN_BUDGET * 3)
    mapped = _run_all_groups(
        groups,
        "Write a compact study summary of the section: key ideas, important terms, and major claims. Keep technical details and avoid repetition.",
        chunk_output=380,
    )
    # Reduce in bounded rounds until the final synthesis prompt is safely small.
    while estimate_tokens("\n".join(mapped)) > CONTEXT_TOKEN_BUDGET:
        reduce_groups = _balanced_groups(
            [Document(page_content=text) for text in mapped], CONTEXT_TOKEN_BUDGET * 3
        )
        mapped = _run_all_groups(reduce_groups, "Combine these section summaries. Preserve coverage and remove repetition.", chunk_output=380)
    context = "\n\n".join(mapped)
    factory = lambda ctx: (
        "Synthesize a student-friendly summary of the entire document from the section summaries below. "
        "Cover the main topic, important concepts and arguments across early and later sections. "
        "Return only a JSON object with exactly two keys: summary (one concise paragraph) and key_points (exactly five strings). "
        "Do not claim details absent from the supplied summaries.\n\nSection summaries:\n" + ctx
    )
    result, used_context = _call("", context=context, prompt_factory=factory, output_tokens=650, return_context=True)
    if len(used_context) + 100 < len(context):
        tail = context[max(0, len(used_context) - 100):]
        mapped_parts = _run_all_groups(
            [used_context, tail],
            "Condense this portion of a document summary without dropping facts or page references.",
            chunk_output=300,
        )
        return summarize_document_from_summaries(mapped_parts)
    parsed = _parse_json(result)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("summary"), str) or not isinstance(parsed.get("key_points"), list):
        raise GroqRequestError("The AI returned a summary in an unsupported format. Please try again.")
    points = [str(item).strip() for item in parsed["key_points"] if str(item).strip()]
    if len(points) < 5:
        raise GroqRequestError("The AI returned fewer than five key points for this PDF. Please try the summary again.")
    return "Summary\n" + parsed["summary"].strip() + "\n\nKey points\n" + "\n".join(f"• {point}" for point in points[:5])


def summarize_document_from_summaries(mapped: list[str]) -> str:
    """Final reduction retry used when Groq forces the final synthesis context smaller."""
    combined = "\n\n".join(mapped)
    if estimate_tokens(combined) > CONTEXT_TOKEN_BUDGET:
        smaller_groups = _balanced_groups([Document(page_content=text) for text in mapped], CONTEXT_TOKEN_BUDGET * 3)
        mapped = _run_all_groups(smaller_groups, "Combine these section summaries while preserving coverage and page references.", chunk_output=300)
        combined = "\n\n".join(mapped)
    prompt_factory = lambda ctx: (
        "Synthesize a student-friendly summary of the full document from these section summaries. Cover all sections, "
        "including early and later content. Return only JSON with summary (one concise paragraph) and key_points (exactly five strings).\n\n" + ctx
    )
    result, used = _call("", context=combined, prompt_factory=prompt_factory, output_tokens=650, return_context=True)
    if len(used) + 100 < len(combined):
        raise GroqRequestError("The provider could not fit the complete set of section summaries. Try again after the rate limit resets.")
    parsed = _parse_json(result)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("summary"), str) or not isinstance(parsed.get("key_points"), list):
        raise GroqRequestError("The AI returned a summary in an unsupported format. Please try again.")
    points = [str(item).strip() for item in parsed["key_points"] if str(item).strip()]
    if len(points) < 5:
        raise GroqRequestError("The AI returned fewer than five key points for this PDF. Please try the summary again.")
    return "Summary\n" + parsed["summary"].strip() + "\n\nKey points\n" + "\n".join(f"• {point}" for point in points[:5])


def _parse_json(text: str):
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        try:
            from json_repair import repair_json
            return json.loads(repair_json(cleaned))
        except Exception:
            return None


def _generate_for_full_context(factory, context: str, *, output_tokens: int,
                               agent_name: str = "rag", request_id: str | None = None,
                               stage: str = "generation") -> list[str]:
    """If an adaptive 413 retry uses a smaller context prefix, process the tail separately."""
    pending = [context]
    results = []
    while pending:
        current = pending.pop(0)
        response, used = _call("", context=current, prompt_factory=factory, output_tokens=output_tokens,
                               return_context=True, agent_name=agent_name, request_id=request_id, stage=stage)
        results.append(response)
        if len(used) + 100 < len(current):
            pending.insert(0, current[max(0, len(used) - 100):])
        if len(pending) + len(results) > MAX_DOCUMENT_CHUNKS * 4:
            raise GroqRequestError("Adaptive PDF generation exceeded its section limit. Split the PDF and retry.")
    return results


def _document_plan_dates(start_date: str, exam_date: str) -> list[str]:
    def parse(value):
        if not isinstance(value, str):
            raise ValueError
        for pattern in ("%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(value.strip(), pattern).date()
            except ValueError:
                continue
        raise ValueError

    try:
        start, end = parse(start_date), parse(exam_date)
    except ValueError as exc:
        raise ValueError("Enter valid start and exam dates for the PDF study plan.") from exc
    if end < start:
        raise ValueError("The exam date must be on or after the study start date.")
    count = (end - start).days + 1
    if count > MAX_PLAN_DAYS:
        raise ValueError(f"Choose a study period of {MAX_PLAN_DAYS} days or fewer.")
    return [(start + timedelta(days=index)).isoformat() for index in range(count)]


def _parse_plan_response(response: str, *, request_id: str, stage: str):
    if not response or not response.strip():
        logger.warning("AI JSON parsing failed agent=rag_planner request_id=%s stage=%s reason=empty_response",
                       request_id, stage)
        return None
    parsed = _parse_json(response)
    if parsed is None:
        logger.warning("AI JSON parsing failed agent=rag_planner request_id=%s stage=%s reason=malformed_json",
                       request_id, stage)
    else:
        logger.info("AI JSON parsing succeeded agent=rag_planner request_id=%s stage=%s",
                    request_id, stage)
    return parsed


def _topic_items_from_response(response: str, valid_pages: list[int], *, request_id: str, section: int) -> list[dict]:
    parsed = _parse_plan_response(response, request_id=request_id, stage=f"topic_map_{section}")
    if isinstance(parsed, dict):
        parsed = parsed.get("topics", parsed.get("outline"))
    if not isinstance(parsed, list):
        logger.warning("AI document plan validation failed agent=rag_planner request_id=%s stage=topic_map section=%d reason=invalid_json_structure",
                       request_id, section)
        raise GroqRequestError(f"The AI could not extract a valid topic outline from document section {section}. Please retry.")
    result = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", item.get("topic", item.get("name", "")))).strip()
        if not title:
            continue
        description = str(item.get("description", item.get("summary", ""))).strip()
        raw_pages = item.get("pages", item.get("page", []))
        if isinstance(raw_pages, (str, int)):
            raw_pages = [raw_pages]
        cited = set()
        if isinstance(raw_pages, list):
            for value in raw_pages:
                try:
                    number = int(value)
                except (TypeError, ValueError):
                    continue
                if number in valid_pages:
                    cited.add(number)
        result.append({
            "title": title,
            "description": description,
            "pages": sorted(cited) if cited else valid_pages,
        })
    return result


def generate_document_plan(vectorstore, start_date: str, exam_date: str, *, request_id: str) -> list[dict]:
    """Map every indexed page into a merged topic outline, then schedule the inclusive date range."""
    dates = _document_plan_dates(start_date, exam_date)
    docs = _documents(vectorstore)
    if not docs:
        raise GroqRequestError("This PDF has no indexed text for study planning.")

    groups = _balanced_groups(docs, CONTEXT_TOKEN_BUDGET * 3)
    if not groups or len(groups) > MAX_DOCUMENT_CHUNKS:
        raise GroqRequestError("The complete PDF exceeds the synchronous planning limit. Split it into smaller files and retry.")

    logger.info("AI document plan started agent=rag_planner request_id=%s indexed_chunks=%d sections=%d pages=%d",
                request_id, len(docs), len(groups), max((int(doc.metadata.get("total_pages", 0)) for doc in docs), default=0))
    outline_by_title = {}
    for section_index, group in enumerate(groups, 1):
        pages = sorted({int(page) for page in re.findall(r"\[Page (\d+)\]", group)})
        factory = lambda ctx, section=section_index: (
            "Extract a complete, concise topic outline from this section of a study PDF. "
            "Include each distinct examinable concept, process, method, formula, and important example supported here. "
            "Use only the evidence; do not infer topics from outside knowledge. Keep descriptions short and preserve page numbers. "
            "Return only JSON: an array of {title, description, pages:[integer]}. If the section has no study content, return [].\n\n"
            f"Section {section}:\n{ctx}"
        )
        responses = _generate_for_full_context(
            factory, group, output_tokens=600, agent_name="rag_planner", request_id=request_id,
            stage=f"topic_map_{section_index}",
        )
        section_topics = []
        for response in responses:
            if not response.strip():
                logger.warning("AI document plan validation failed agent=rag_planner request_id=%s stage=topic_map section=%d reason=empty_response",
                               request_id, section_index)
                raise GroqRequestError(f"The AI returned an empty outline for document section {section_index}. Please retry.")
            section_topics.extend(_topic_items_from_response(response, pages, request_id=request_id, section=section_index))
        for topic in section_topics:
            key = re.sub(r"\W+", " ", topic["title"].casefold()).strip()
            existing = outline_by_title.get(key)
            if existing:
                existing["pages"] = sorted(set(existing["pages"]) | set(topic["pages"]))
                if topic["description"] and topic["description"] not in existing["description"]:
                    existing["description"] = "; ".join(filter(None, (existing["description"], topic["description"])))
            else:
                outline_by_title[key] = topic
    outline = list(outline_by_title.values())
    if not outline:
        raise GroqRequestError("The full PDF did not yield a usable study topic outline. Check the document text and retry.")
    logger.info("AI document outline completed agent=rag_planner request_id=%s unique_topics=%d sections=%d",
                request_id, len(outline), len(groups))

    exam_date_iso = dates[-1]
    if len(dates) >= 4:
        study_dates, practice_date, final_review_date = dates[:-2], dates[-2], dates[-1]
    elif len(dates) >= 2:
        study_dates, practice_date, final_review_date = dates[:-1], None, dates[-1]
    else:
        study_dates, practice_date, final_review_date = dates, None, None

    assignments = {day: [] for day in study_dates}
    for index, topic in enumerate(outline):
        day_index = min(len(study_dates) - 1, index * len(study_dates) // len(outline))
        assignments[study_dates[day_index]].append(topic)
    assigned_so_far = []
    practice_only_dates = set()
    for day in study_dates:
        if not assignments[day]:
            # Longer plans than the outline use intentional practice/review sessions.
            assignments[day] = assigned_so_far[-3:] or outline[: min(3, len(outline))]
            practice_only_dates.add(day)
        assigned_so_far.extend(item for item in assignments[day] if item not in assigned_so_far)

    generated_by_date = {}

    def generate_study_batch(batch_dates: list[str], depth: int = 0):
        batch = [{
            "date": day,
            "day": f"Day {dates.index(day) + 1}",
            "topics": [topic["title"] for topic in assignments[day]],
            "source_pages": sorted({page for topic in assignments[day] for page in topic["pages"]}),
        } for day in batch_dates]
        context = json.dumps(batch, ensure_ascii=False)
        factory = lambda ctx: (
            "Create one focused study task for each supplied date, using only the supplied document topics. "
            "Include a short recall or practice activity in each study task. Do not introduce unrelated topics. "
            "Return only a JSON array with exactly one object per date, each containing date, task (non-empty), and duration (non-empty). "
            "Use the exact ISO dates.\n\nAssigned document topics:\n" + ctx
        )
        response, used = _call(
            "", context=context, prompt_factory=factory, output_tokens=min(600, OUTPUT_TOKEN_BUDGET), return_context=True,
            agent_name="rag_planner", request_id=request_id, stage=f"schedule_batch_{dates.index(batch_dates[0]) + 1}",
        )
        if len(used) + 20 < len(context):
            if len(batch_dates) == 1 or depth >= 8:
                raise GroqRequestError("A day's complete topic list exceeds the schedule request limit. Add more study days and retry.")
            midpoint = len(batch_dates) // 2
            generate_study_batch(batch_dates[:midpoint], depth + 1)
            generate_study_batch(batch_dates[midpoint:], depth + 1)
            return
        stage = f"schedule_batch_{dates.index(batch_dates[0]) + 1}"
        parsed = _parse_plan_response(response, request_id=request_id, stage=stage)
        if isinstance(parsed, dict):
            parsed = parsed.get("schedule", parsed.get("study_plan"))
        if not isinstance(parsed, list):
            raise GroqRequestError("The AI returned an invalid schedule section. Please retry the PDF plan.")
        by_date = {}
        returned_dates = []
        for row in parsed:
            if not isinstance(row, dict):
                returned_dates.append(None)
                continue
            row_date = row.get("date", row.get("study_date"))
            try:
                normalized_date = _document_plan_dates(row_date, row_date)[0]
            except (ValueError, TypeError):
                returned_dates.append(None)
                continue
            returned_dates.append(normalized_date)
            task = str(row.get("task", row.get("activity", ""))).strip()
            duration = str(row.get("duration", row.get("time", ""))).strip()
            if normalized_date in batch_dates and task and duration:
                by_date[normalized_date] = {"task": task, "duration": duration}
        if (set(by_date) != set(batch_dates) or len(returned_dates) != len(batch_dates)
                or len(returned_dates) != len(set(returned_dates)) or set(returned_dates) != set(batch_dates)):
            missing_fields = [
                "task_or_duration" for row in parsed if isinstance(row, dict) and row.get("date") in batch_dates
                and (not str(row.get("task", row.get("activity", ""))).strip()
                     or not str(row.get("duration", row.get("time", ""))).strip())
            ]
            logger.warning("AI document schedule validation failed agent=rag_planner request_id=%s expected_dates=%d actual_dates=%d missing_fields=%s",
                           request_id, len(batch_dates), len(by_date), ",".join(sorted(set(missing_fields))) or "dates")
            if len(batch_dates) > 1 and depth < 8:
                midpoint = len(batch_dates) // 2
                generate_study_batch(batch_dates[:midpoint], depth + 1)
                generate_study_batch(batch_dates[midpoint:], depth + 1)
                return
            raise GroqRequestError("The AI did not return a complete schedule row for every requested date. Please retry.")
        generated_by_date.update(by_date)

    generated_dates = [day for day in study_dates if day not in practice_only_dates]
    for index in range(0, len(generated_dates), 4):
        generate_study_batch(generated_dates[index:index + 4])

    schedule = []
    for index, day in enumerate(dates):
        if day in practice_only_dates:
            selected_topics = assignments[day]
            row = {
                "task": "Review previously covered topics and complete short recall practice.",
                "duration": "1 hour",
            }
        elif day in generated_by_date:
            row = generated_by_date[day]
            selected_topics = assignments[day]
        elif day == practice_date:
            selected_topics = outline
            row = {
                "task": "Practice questions across the document topics, then revisit difficult points.",
                "duration": "1.5 hours",
            }
        elif day == final_review_date:
            selected_topics = outline
            row = {
                "task": "Light revision and short practice across the full document outline; do not start new material.",
                "duration": "1 hour",
            }
        else:
            raise GroqRequestError("The PDF planner could not cover every requested study date.")
        schedule.append({
            "day": f"Day {index + 1}", "date": day,
            "task": row["task"], "duration": row["duration"],
            "topics": [topic["title"] for topic in selected_topics],
            "pages": sorted({page for topic in selected_topics for page in topic["pages"]}),
        })

    if [row["date"] for row in schedule] != dates or not all(row["task"] and row["duration"] for row in schedule):
        raise GroqRequestError("The PDF planner could not validate the complete schedule. Please retry.")
    logger.info("AI document plan completed agent=rag_planner request_id=%s schedule_rows=%d topics=%d exam_date=%s",
                request_id, len(schedule), len(outline), exam_date_iso)
    return schedule


def _stratified_groups(docs: list[Document], requested: int, per_group: int = 3) -> list[str]:
    if not docs:
        return []
    # Spread source chunks across the entire document; keep each LLM request small.
    group_count = min(len(docs), max(1, math.ceil(requested / 2)), 12)
    anchors = [round(i * (len(docs) - 1) / max(1, group_count - 1)) for i in range(group_count)]
    groups = []
    for anchor in anchors:
        block = docs[anchor:anchor + 1]
        groups.append("\n\n".join(f"{_page_label(doc)}{doc.page_content}" for doc in block))
    # Remove identical groups when the document contains fewer chunks than target groups.
    return list(OrderedDict((group, None) for group in groups))


def generate_quiz(vectorstore, number: int = 5) -> str:
    requested = max(1, min(20, int(number)))
    docs = _documents(vectorstore)
    groups = _stratified_groups(docs, requested, per_group=3)
    if not groups:
        raise GroqRequestError("This PDF has no indexed text for quiz generation.")
    candidates = []
    per_group = max(1, math.ceil(requested / len(groups)) + 1)
    for group in groups:
        factory = lambda ctx: (
            f"Create up to {per_group} distinct multiple-choice questions from this document section. "
            "Return only a JSON array of objects with question, options (exactly four distinct strings), answer (exactly one option), explanation, and page (integer when visible). "
            "Use only facts in the section; if it cannot support a question, return [].\n\nEvidence:\n" + ctx
        )
        for response in _generate_for_full_context(factory, group, output_tokens=500):
            parsed = _parse_json(response)
            if isinstance(parsed, dict):
                parsed = parsed.get("questions", [])
            if isinstance(parsed, list):
                candidates.extend(parsed)
    valid = []
    seen = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        question = str(item.get("question", "")).strip()
        options = item.get("options")
        answer = str(item.get("answer", "")).strip()
        if not question or not isinstance(options, list) or len(options) != 4:
            continue
        options = [str(option).strip() for option in options]
        if any(not option for option in options) or len({option.casefold() for option in options}) != 4:
            continue
        if answer.upper() in ("A", "B", "C", "D"):
            answer = options[ord(answer.upper()) - ord("A")]
        if answer not in options:
            continue
        key = re.sub(r"\W+", " ", question.casefold()).strip()
        if any(key == prior or SequenceMatcher(None, key, prior).ratio() >= 0.92 for prior in seen):
            continue
        seen.append(key)
        valid.append({**item, "question": question, "options": options, "answer": answer})
        if len(valid) >= requested:
            break
    if not valid:
        raise GroqRequestError("The AI returned no valid, document-grounded quiz questions. Try again.")
    rendered = []
    for index, item in enumerate(valid, 1):
        rendered.append(
            f"{index}. {item['question']}\n" + "\n".join(f"{chr(65 + n)}. {option}" for n, option in enumerate(item["options"]))
            + f"\nAnswer: {item['answer']}\nExplanation: {str(item.get('explanation', '')).strip()}"
            + (f"\nSource: Page {item['page']}" if str(item.get("page", "")).isdigit() else "")
        )
    return "\n\n".join(rendered)


def generate_flashcards(vectorstore, number: int = 10) -> str:
    requested = max(1, min(30, int(number)))
    docs = _documents(vectorstore)
    groups = _stratified_groups(docs, requested, per_group=4)
    if not groups:
        raise GroqRequestError("This PDF has no indexed text for flashcard generation.")
    per_group = max(1, math.ceil(requested / len(groups)) + 1)
    cards, seen = [], []
    for group in groups:
        factory = lambda ctx: (
            f"Create up to {per_group} useful study flashcards from this section. Return only a JSON array of objects with front, back, and page (integer when visible). "
            "Use concise questions/terms on the front and accurate answers on the back. Use only the evidence.\n\nEvidence:\n" + ctx
        )
        for response in _generate_for_full_context(factory, group, output_tokens=450):
            parsed = _parse_json(response)
            if isinstance(parsed, dict):
                parsed = parsed.get("cards", [])
            if not isinstance(parsed, list):
                continue
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                front, back = str(item.get("front", "")).strip(), str(item.get("back", "")).strip()
                key = re.sub(r"\W+", " ", front.casefold()).strip()
                if not front or not back or any(key == prior or SequenceMatcher(None, key, prior).ratio() >= 0.9 for prior in seen):
                    continue
                seen.append(key)
                cards.append((front, back, item.get("page")))
                if len(cards) >= requested:
                    break
            if len(cards) >= requested:
                break
        if len(cards) >= requested:
            break
    if not cards:
        raise GroqRequestError("The AI returned no valid flashcards grounded in this PDF. Try again.")
    return "\n\n".join(
        f"{index}. Front: {front}\nBack: {back}" + (f"\nSource: Page {page}" if str(page).isdigit() else "")
        for index, (front, back, page) in enumerate(cards, 1)
    )
