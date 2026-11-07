import json

import pymupdf as fitz
import pytest
from langchain_core.documents import Document

from document_processing import DocumentProcessingError, extract_pdf_pages, split_page_documents
import rag_engine


def make_pdf(page_texts, *, password=""):
    pdf = fitz.open()
    for text in page_texts:
        page = pdf.new_page()
        if text:
            page.insert_text((72, 72), text)
    options = {"encryption": fitz.PDF_ENCRYPT_AES_256, "owner_pw": "owner", "user_pw": password} if password else {}
    return pdf.tobytes(**options)


def test_page_extraction_skips_empty_pages_and_preserves_page_numbers():
    pages, total = extract_pdf_pages(make_pdf(["Early section " * 8, "", "Later section " * 8]))
    assert total == 3
    assert [page["page"] for page in pages] == [1, 3]


def test_corrupt_encrypted_and_scanned_pdfs_fail_with_actionable_errors():
    with pytest.raises(DocumentProcessingError, match="readable PDF"):
        extract_pdf_pages(b"not a PDF")
    with pytest.raises(DocumentProcessingError, match="password-protected"):
        extract_pdf_pages(make_pdf(["Some readable text " * 8], password="secret"))
    with pytest.raises(DocumentProcessingError, match="OCR is required"):
        extract_pdf_pages(make_pdf([""]))


def test_page_chunks_keep_owner_document_and_chunk_metadata(monkeypatch):
    monkeypatch.setenv("RAG_CHUNK_SIZE_TOKENS", "200")
    monkeypatch.setenv("RAG_CHUNK_OVERLAP_TOKENS", "20")
    pages = [{"page": 1, "text": ("Important early concept. " * 100)}, {"page": 4, "text": "Later concept. " * 40}]
    chunks = split_page_documents(pages, document_id="doc-a", filename="lecture.pdf", owner_id=7, uploaded_at="2026-11-05", total_pages=5)
    assert len(chunks) > 2
    assert all(chunk.page_content.strip() for chunk in chunks)
    assert [chunk.metadata["chunk_index"] for chunk in chunks] == list(range(len(chunks)))
    assert {chunk.metadata["page"] for chunk in chunks} == {1, 4}
    assert all(chunk.metadata["owner_id"] == "7" and chunk.metadata["document_id"] == "doc-a" for chunk in chunks)
    assert all(chunk.metadata["total_pages"] == 5 for chunk in chunks)


class FakeLLM:
    def __init__(self, outputs=None, errors=None):
        self.prompts = []
        self.outputs = list(outputs or [])
        self.errors = list(errors or [])

    def invoke(self, prompt):
        self.prompts.append(prompt)
        if self.errors:
            raise self.errors.pop(0)
        value = self.outputs.pop(0) if self.outputs else "grounded answer"
        return type("Result", (), {"content": value})()


class StatusError(Exception):
    def __init__(self, status_code, headers=None):
        self.status_code = status_code
        self.response = type("Response", (), {"status_code": status_code, "headers": headers or {}})()
        super().__init__(f"provider status {status_code}")


def test_retrieval_budget_and_citations_include_later_relevant_pages(monkeypatch):
    class Store:
        def similarity_search(self, query, k):
            return [Document(page_content="early evidence", metadata={"page": 2}), Document(page_content="later evidence", metadata={"page": 48})]

    fake = FakeLLM(["Answer supported by the document."])
    monkeypatch.setattr(rag_engine, "llm", fake)
    monkeypatch.setattr(rag_engine, "CONTEXT_TOKEN_BUDGET", 60)
    answer = rag_engine.rag_query(Store(), "What changed in the later section?")
    assert "p. 2" in answer and "p. 48" in answer
    assert rag_engine.estimate_tokens(fake.prompts[0]) < 500


def test_413_rebuilds_a_smaller_prompt_and_429_retries(monkeypatch):
    monkeypatch.setattr(rag_engine, "CONTEXT_TOKEN_BUDGET", 2400)
    oversized = FakeLLM(["recovered"], errors=[StatusError(413)])
    monkeypatch.setattr(rag_engine, "llm", oversized)
    result = rag_engine._call("", context="evidence " * 400, prompt_factory=lambda ctx: f"Evidence: {ctx}")
    assert result == "recovered"
    assert len(oversized.prompts) == 2
    assert len(oversized.prompts[1]) < len(oversized.prompts[0])

    limited = FakeLLM(["recovered"], errors=[StatusError(429, {"retry-after": "0"})])
    monkeypatch.setattr(rag_engine, "llm", limited)
    monkeypatch.setattr(rag_engine.time, "sleep", lambda _: None)
    assert rag_engine._call("short bounded prompt") == "recovered"
    assert len(limited.prompts) == 2


def test_quiz_validation_removes_duplicates_and_returns_valid_options(monkeypatch):
    docs = [Document(page_content=f"section {i}", metadata={"page": i + 1, "chunk_index": i}) for i in range(8)]

    class Store:
        docstore = type("DocStore", (), {"_dict": {str(i): doc for i, doc in enumerate(docs)}})()
        index_to_docstore_id = {i: str(i) for i in range(len(docs))}

    questions = [
        {"question": question, "options": ["A", "B", "C", "D"], "answer": "A", "explanation": "Evidence supports A", "page": i + 1}
        for i, question in enumerate(("What is the alpha mechanism?", "How does beta feedback change?", "Why is gamma boundary important?"))
    ]
    responses = [json.dumps(questions) for _ in range(3)]
    monkeypatch.setattr(rag_engine, "llm", FakeLLM(responses))
    result = rag_engine.generate_quiz(Store(), 3)
    assert "1. What is the alpha mechanism?" in result
    assert result.count("Answer: A") == 3


def test_document_planner_maps_all_indexed_sections_and_covers_every_date(monkeypatch):
    docs = [
        Document(
            page_content=f"Page {page} concept. " + ("source evidence " * 65),
            metadata={"page": page, "chunk_index": page - 1, "total_pages": 31},
        )
        for page in range(1, 32)
    ]

    class Store:
        docstore = type("DocStore", (), {"_dict": {str(i): doc for i, doc in enumerate(docs)}})()
        index_to_docstore_id = {i: str(i) for i in range(len(docs))}

    mapped_pages = set()

    def fake_call(prompt, *, context="", prompt_factory=None, return_context=False, stage="", **kwargs):
        if stage.startswith("topic_map_"):
            pages = {int(value) for value in __import__("re").findall(r"\[Page (\d+)\]", context)}
            mapped_pages.update(pages)
            response = json.dumps([
                {"title": f"Topic {page}", "description": f"Content for page {page}", "pages": [page]}
                for page in sorted(pages)
            ])
        elif stage.startswith("schedule_batch_"):
            payload = json.loads(context)
            response = json.dumps([
                {"date": item["date"], "task": f"Study and practice {item['topics'][0]}", "duration": "1 hour"}
                for item in payload
            ])
        else:
            raise AssertionError(f"Unexpected planning stage: {stage}")
        return (response, context) if return_context else response

    monkeypatch.setattr(rag_engine, "CONTEXT_TOKEN_BUDGET", 300)
    monkeypatch.setattr(rag_engine, "_call", fake_call)
    schedule = rag_engine.generate_document_plan(Store(), "2026-11-07", "2026-11-13", request_id="test-full-doc")

    expected_dates = [f"2026-11-{day:02d}" for day in range(7, 14)]
    assert mapped_pages == set(range(1, 32))
    assert [row["date"] for row in schedule] == expected_dates
    assert set(page for row in schedule for page in row["pages"]) == set(range(1, 32))
    assert {topic for row in schedule for topic in row["topics"]} == {f"Topic {page}" for page in range(1, 32)}
    assert "Practice questions" in schedule[-2]["task"]
    assert "Light revision" in schedule[-1]["task"]


def test_document_planner_rejects_malformed_topic_outline_without_partial_schedule(monkeypatch):
    docs = [Document(page_content="[Page 1] topic evidence", metadata={"page": 1, "chunk_index": 0})]

    class Store:
        docstore = type("DocStore", (), {"_dict": {"0": docs[0]}})()
        index_to_docstore_id = {0: "0"}

    monkeypatch.setattr(rag_engine, "_call", lambda prompt, **kwargs: ("not JSON", kwargs.get("context", "")))
    with pytest.raises(rag_engine.GroqRequestError, match="valid topic outline"):
        rag_engine.generate_document_plan(Store(), "2026-11-07", "2026-11-07", request_id="test-invalid-outline")
