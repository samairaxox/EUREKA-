from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from dotenv import load_dotenv
from document_processing import split_plain_text
import json
import re
import os
import time
import random
import math
import logging
from datetime import date, datetime, timedelta
from llm_runtime import LLM_GATE
from email.utils import parsedate_to_datetime

load_dotenv()

logger = logging.getLogger(__name__)

llm = ChatGroq(
    model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"), temperature=0.5,
    groq_api_key=os.getenv("GROQ_API_KEY"),
    max_tokens=int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "700")),
    reasoning_effort=os.getenv("GROQ_REASONING_EFFORT", "low"),
    timeout=float(os.getenv("GROQ_TIMEOUT_SECONDS", "60")), max_retries=0,
)


def safe_parse(content, *, agent_name="unknown", request_id=None, expected_root=None):
    """Parse model JSON conservatively and report outcomes without logging content."""
    request_id = request_id or "untracked"
    if isinstance(content, str):
        clean = content.strip().lstrip("\ufeff").strip()
    elif isinstance(content, list):
        # Some chat model adapters return content blocks instead of one string.
        clean = "\n".join(
            block.get("text", "") for block in content
            if isinstance(block, dict) and isinstance(block.get("text"), str)
        ).strip()
    else:
        clean = ""

    logger.info("AI response received agent=%s request_id=%s empty=%s",
                agent_name, request_id, not bool(clean))
    if not clean:
        logger.warning("AI JSON parsing failed agent=%s request_id=%s reason=empty_response",
                       agent_name, request_id)
        raise ValueError(f"The {agent_name} returned an empty response. Please try again.")

    fenced = re.fullmatch(r"```(?:json)?\s*(.*?)\s*```", clean, flags=re.IGNORECASE | re.DOTALL)
    if fenced:
        clean = fenced.group(1).strip()
    parse_mode = "direct"
    try:
        parsed = json.loads(clean)
    except json.JSONDecodeError as original_error:
        try:
            from json_repair import repair_json
            repaired = repair_json(clean)
            if not isinstance(repaired, str) or not repaired.strip():
                raise ValueError("JSON repair returned empty content")
            parsed = json.loads(repaired)
            parse_mode = "repaired"
        except Exception as repair_error:
            logger.warning(
                "AI JSON parsing failed agent=%s request_id=%s reason=malformed_json direct_error=%s repair_error=%s",
                agent_name, request_id, type(original_error).__name__, type(repair_error).__name__,
            )
            raise ValueError(f"The {agent_name} returned malformed data. Please try again.") from repair_error
    if expected_root == "schedule" and not (
        isinstance(parsed, list) or
        isinstance(parsed, dict) and isinstance(parsed.get("schedule", parsed.get("study_plan")), list)
    ):
        logger.warning("AI JSON parsing failed agent=%s request_id=%s reason=unexpected_structure",
                       agent_name, request_id)
        raise ValueError("The planner returned an unexpected response format. Please try again.")
    if expected_root == "object" and not isinstance(parsed, dict):
        logger.warning("AI JSON parsing failed agent=%s request_id=%s reason=unexpected_structure",
                       agent_name, request_id)
        raise ValueError(f"The {agent_name} returned an unexpected response format. Please try again.")
    logger.info("AI JSON parsing succeeded agent=%s request_id=%s mode=%s",
                agent_name, request_id, parse_mode)
    return parsed


def _invoke_summary(chain, payload):
    retries = max(0, min(4, int(os.getenv("GROQ_RETRY_COUNT", "2"))))
    for attempt in range(retries + 1):
        try:
            with LLM_GATE:
                return chain.invoke(payload)
        except Exception as exc:
            status = getattr(exc, "status_code", None) or getattr(getattr(exc, "response", None), "status_code", None)
            message = str(exc).lower()
            oversized = status == 413 or any(term in message for term in ("request too large", "token limit", "context length"))
            if oversized:
                raise ValueError("Groq rejected a bounded summary section as too large; reduce the input or split the PDF into smaller parts.") from exc
            rate_limited = status == 429 or "rate limit" in message
            transient = status in (408, 425, 500, 502, 503, 504) or isinstance(exc, (TimeoutError, ConnectionError))
            if not (rate_limited or transient) or attempt >= retries:
                if rate_limited:
                    raise ValueError("Groq is temporarily rate-limited. Wait briefly, then try again.") from exc
                raise
            headers = getattr(getattr(exc, "response", None), "headers", {}) or {}
            retry_after = headers.get("retry-after", headers.get("Retry-After"))
            try:
                delay = max(0.0, float(retry_after))
            except (TypeError, ValueError):
                try:
                    delay = max(0.0, parsedate_to_datetime(retry_after).timestamp() - time.time())
                except (TypeError, ValueError, OverflowError):
                    delay = min(8.0, 0.5 * 2 ** attempt) + random.uniform(0.05, 0.35)
            max_wait = max(1, int(os.getenv("GROQ_MAX_RETRY_WAIT_SECONDS", "120")))
            if delay > max_wait:
                raise RuntimeError("Groq requested a longer rate-limit wait. Wait for the provider reset, then try again.") from exc
            time.sleep(delay)


def _adaptive_section_summary(chain, payload):
    """If Groq still rejects one section, divide that section and summarize both halves."""
    try:
        return _invoke_summary(chain, payload).content.strip()
    except ValueError as exc:
        text = payload.get("text", "")
        if "too large" not in str(exc).lower() or len(text) < 600:
            raise
        target_tokens = max(200, math.ceil(len(text) / 6))
        parts = split_plain_text(text, chunk_size_tokens=target_tokens, overlap_tokens=0)
        if len(parts) < 2:
            middle = len(text) // 2
            parts = [text[:middle], text[middle:]]
        summaries = []
        for part in parts:
            summaries.append(_adaptive_section_summary(chain, {**payload, "text": part}))
        return "\n".join(summaries)

def summarizer_agent(text: str) -> dict:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Add readable study text before requesting a summary.")
    max_chunks = max(1, int(os.getenv("SUMMARY_MAX_CHUNKS", "160")))
    chunk_tokens = max(200, int(os.getenv("SUMMARY_CHUNK_SIZE_TOKENS", "800")))
    overlap_tokens = max(0, min(chunk_tokens // 4, int(os.getenv("SUMMARY_CHUNK_OVERLAP_TOKENS", "80"))))
    chars_per_token = max(2, int(os.getenv("RAG_CHARS_PER_TOKEN", "3")))
    chunk_chars = chunk_tokens * chars_per_token
    overlap_chars = overlap_tokens * chars_per_token
    estimated_chunks = max(1, math.ceil(max(0, len(text) - overlap_chars) / max(1, chunk_chars - overlap_chars)))
    if estimated_chunks > max_chunks:
        raise ValueError(f"This document needs about {estimated_chunks} sections, above the synchronous summary limit of {max_chunks}. Split the PDF and try again.")
    chunks = split_plain_text(text, chunk_size_tokens=chunk_tokens, overlap_tokens=overlap_tokens)
    if len(chunks) > max_chunks:
        raise ValueError(f"This document has {len(chunks)} sections, above the synchronous summary limit of {max_chunks}. Split the PDF and try again.")
    map_prompt = PromptTemplate.from_template(
        "Summarize this section of study notes. Preserve key terms, arguments, and facts; avoid adding information. "
        "Keep it concise and retain any page references in the text.\n\nSection {section} of {total}:\n{text}"
    )
    chain = map_prompt | llm
    mapped = []
    for index, chunk in enumerate(chunks, 1):
        try:
            mapped.append(_adaptive_section_summary(chain, {"text": chunk, "section": index, "total": len(chunks)}))
        except Exception as exc:
            raise ValueError(f"Summary stopped at section {index} of {len(chunks)}; no partial result was returned. {exc}") from exc

    # Reduce in bounded rounds so the final schema request stays under the same conservative prompt budget.
    while math.ceil(sum(map(len, mapped)) / 3) > int(os.getenv("SUMMARY_REDUCE_CONTEXT_TOKENS", "2200")):
        reduction_groups = split_plain_text("\n\n".join(mapped), chunk_size_tokens=1500, overlap_tokens=0)
        reduce_prompt = PromptTemplate.from_template(
            "Combine these section summaries into one compact summary. Preserve coverage across all sections and remove repetition:\n\n{text}"
        )
        reduce_chain = reduce_prompt | llm
        mapped = [
            _adaptive_section_summary(reduce_chain, {"text": group})
            for group in reduction_groups
        ]
    final_prompt = PromptTemplate.from_template(
        "Synthesize a summary of the full study document from all section summaries below. Cover early and later sections, "
        "retain important technical details, and avoid repetition.\n\n"
        "Return ONLY a JSON object with exactly these two keys:\n"
        "summary: one short paragraph, maximum 4 sentences\n"
        "key_points: a list of exactly 5 bullet points as strings\n\n"
        "Rules:\n"
        "- No extra text before or after the JSON\n"
        "- No markdown formatting\n"
        "- Just raw JSON, nothing else\n\nSection summaries:\n{text}"
    )
    final_chain = final_prompt | llm
    result = _invoke_summary(final_chain, {"text": "\n\n".join(mapped)})
    parsed = safe_parse(result.content, agent_name="summarizer", expected_root="object")
    if not isinstance(parsed, dict) or not isinstance(parsed.get("summary"), str) or not isinstance(parsed.get("key_points"), list):
        raise ValueError("The AI returned a summary in an unsupported format. Please try again.")
    points = [str(point).strip() for point in parsed["key_points"] if str(point).strip()]
    if len(points) < 5:
        raise ValueError("The AI returned fewer than five key points. Please try the summary again.")
    return {"summary": parsed["summary"].strip(), "key_points": points[:5]}


def _schedule_date(value) -> str:
    """Normalize supported AI date values to the API's YYYY-MM-DD schema."""
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    if not isinstance(value, str):
        raise ValueError("The AI returned a schedule item without a valid date. Please try again.")
    value = value.strip()
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError("The AI returned an invalid schedule date. Please try again.")


def normalize_schedule(parsed, *, request_id=None, expected_dates=None) -> list:
    """Return validated schedule rows using day/date/task/duration keys."""
    request_id = request_id or "untracked"
    if isinstance(parsed, dict):
        parsed = parsed.get("schedule", parsed.get("study_plan"))
    if not isinstance(parsed, list) or not parsed or len(parsed) > 120:
        logger.warning("AI schedule validation failed agent=planner request_id=%s reason=unexpected_structure",
                       request_id)
        raise ValueError("The AI returned an unsupported or empty schedule. Please try again.")

    normalized = []
    for index, item in enumerate(parsed, 1):
        if not isinstance(item, dict):
            logger.warning("AI schedule validation failed agent=planner request_id=%s row=%d reason=invalid_item",
                           request_id, index)
            raise ValueError(f"The AI returned an invalid schedule item for Day {index}. Please try again.")

        def first_text(*keys):
            for key in keys:
                value = item.get(key)
                if isinstance(value, (str, int, float)) and str(value).strip():
                    return str(value).strip()
            return ""

        day = first_text("day", "day_label") or f"Day {index}"
        task = first_text("task", "activity", "study_task", "subject")
        duration = first_text("duration", "time", "estimated_duration", "study_duration")
        raw_date = item.get("date", item.get("study_date"))
        if not task or not duration:
            missing = [name for name, value in (("task", task), ("duration", duration)) if not value]
            logger.warning("AI schedule fields missing agent=planner request_id=%s row=%d fields=%s",
                           request_id, index, ",".join(missing))
            raise ValueError(f"The AI returned an incomplete schedule item for {day}. Please generate the schedule again.")
        try:
            schedule_date = _schedule_date(raw_date)
        except ValueError:
            logger.warning("AI schedule fields invalid agent=planner request_id=%s row=%d field=date",
                           request_id, index)
            raise
        normalized.append({"day": day, "date": schedule_date, "task": task, "duration": duration})
    if expected_dates is not None:
        expected = list(expected_dates)
        actual = [row["date"] for row in normalized]
        if len(actual) != len(set(actual)) or set(actual) != set(expected):
            logger.warning("AI schedule date coverage failed agent=planner request_id=%s expected=%d actual=%d",
                           request_id, len(expected), len(actual))
            raise ValueError("The AI did not return one schedule item for every requested date. Please try again.")
        by_date = {row["date"]: row for row in normalized}
        return [by_date[date_value] for date_value in expected]
    return normalized


def planner_agent(topic: str, exam_date: str, start_date: str = "", request_id=None) -> list:
    if not isinstance(topic, str) or not topic.strip():
        raise ValueError("Enter a topic before generating a study plan.")
    if len(topic) > 12000:
        raise ValueError("This topic is too long for the text planner. Upload the source PDF to use full-document planning.")
    try:
        start = date.fromisoformat(_schedule_date(start_date or exam_date))
        end = date.fromisoformat(_schedule_date(exam_date))
    except ValueError as exc:
        raise ValueError("Enter valid start and exam dates.") from exc
    if end < start:
        raise ValueError("The exam date must be on or after the start date.")
    date_count = (end - start).days + 1
    if date_count > 120:
        raise ValueError("Choose a study period of 120 days or fewer.")
    requested_dates = [(start + timedelta(days=offset)).isoformat() for offset in range(date_count)]

    schedule = []
    batch_size = 7
    for offset in range(0, len(requested_dates), batch_size):
        batch_dates = requested_dates[offset:offset + batch_size]
        prompt = PromptTemplate.from_template(
            "Create a practical revision plan for this topic: {topic}\n"
            "Exam date: {exam_date}\n"
            "Create exactly one schedule item for every ISO date in this ordered list, with no other dates: {dates}\n\n"
            "Use focused study tasks. Include short practice in study sessions and make the final exam date light revision only. "
            "Do not invent unrelated topics.\n"
            "Return only a JSON array. Each item must contain day (for example Day 1), date (exact ISO date), "
            "task (non-empty string), and duration (non-empty string such as 1 hour). No markdown or extra text."
        )
        result = _invoke_summary(prompt | llm, {
            "topic": topic.strip(), "exam_date": end.isoformat(), "dates": json.dumps(batch_dates),
        })
        parsed = safe_parse(result.content, agent_name="planner", request_id=request_id, expected_root="schedule")
        schedule.extend(normalize_schedule(parsed, request_id=request_id, expected_dates=batch_dates))

    schedule = [{**row, "day": f"Day {index}"} for index, row in enumerate(schedule, 1)]
    logger.info("AI request completed agent=planner request_id=%s schedule_rows=%d", request_id or "untracked", len(schedule))
    return schedule
