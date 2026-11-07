"""Bounded, page-aware PDF extraction and text splitting used by RAG and PDF tools."""
from __future__ import annotations

import os
import re
from typing import Iterable

import pymupdf as fitz
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


class DocumentProcessingError(ValueError):
    """The uploaded document cannot be safely read as text."""


def _normalize_page_text(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_pdf_pages(source: bytes | bytearray | str, *, min_chars: int | None = None) -> tuple[list[dict], int]:
    """Extract each page independently; return only non-empty pages and total page count."""
    try:
        doc = fitz.open(stream=source, filetype="pdf") if isinstance(source, (bytes, bytearray)) else fitz.open(source)
    except Exception as exc:
        raise DocumentProcessingError("This file is not a readable PDF. Please upload a valid, uncorrupted PDF.") from exc

    try:
        if doc.is_encrypted and not doc.authenticate(""):
            raise DocumentProcessingError("This PDF is password-protected. Remove its password and upload it again.")
        total_pages = len(doc)
        pages = []
        total_chars = 0
        for page_index in range(total_pages):
            try:
                text = doc.load_page(page_index).get_text("text") or ""
            except Exception as exc:
                raise DocumentProcessingError(f"Could not extract page {page_index + 1} from this PDF.") from exc
            text = _normalize_page_text(text)
            if text:
                pages.append({"page": page_index + 1, "text": text})
                total_chars += len(text)
        if not total_pages:
            raise DocumentProcessingError("This PDF has no pages to process.")
        threshold = min_chars if min_chars is not None else int(os.getenv("PDF_MIN_EXTRACTABLE_CHARS", "40"))
        if total_chars < threshold:
            raise DocumentProcessingError(
                "This PDF contains too little selectable text. It may be scanned or image-based; OCR is required before it can be studied."
            )
        return pages, total_pages
    finally:
        doc.close()


def split_page_documents(
    pages: Iterable[dict], *, document_id: str = "", filename: str = "",
    owner_id: str | int | None = None, uploaded_at: str = "", total_pages: int | None = None,
) -> list[Document]:
    """Split per page so every chunk retains a precise page citation."""
    chunk_tokens = max(200, int(os.getenv("RAG_CHUNK_SIZE_TOKENS", "850")))
    overlap_tokens = max(0, min(chunk_tokens // 4, int(os.getenv("RAG_CHUNK_OVERLAP_TOKENS", "100"))))
    chars_per_token = max(2, int(os.getenv("RAG_CHARS_PER_TOKEN", "3")))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_tokens * chars_per_token,
        chunk_overlap=overlap_tokens * chars_per_token,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
        add_start_index=True, strip_whitespace=True,
    )
    pages = list(pages)
    page_count = total_pages or max((int(page["page"]) for page in pages), default=0)
    output = []
    chunk_index = 0
    for page in pages:
        text = str(page.get("text", "")).strip()
        if not text:
            continue
        metadata = {
            "document_id": document_id, "filename": filename,
            "owner_id": str(owner_id) if owner_id is not None else "",
            "page": int(page["page"]), "page_start": int(page["page"]),
            "page_end": int(page["page"]), "total_pages": page_count,
            "uploaded_at": uploaded_at,
        }
        for piece in splitter.split_text(text):
            if piece.strip():
                output.append(Document(page_content=piece.strip(), metadata={**metadata, "chunk_index": chunk_index}))
                chunk_index += 1
    if not output:
        raise DocumentProcessingError("No searchable text could be created from this PDF.")
    return output


def extract_pdf_chunks(
    source: bytes | bytearray | str, *, document_id: str = "", filename: str = "",
    owner_id: str | int | None = None, uploaded_at: str = "", max_chunks: int = 160,
) -> tuple[list[Document], int]:
    """Extract and split one page at a time to avoid retaining a second full-text copy."""
    try:
        doc = fitz.open(stream=source, filetype="pdf") if isinstance(source, (bytes, bytearray)) else fitz.open(source)
    except Exception as exc:
        raise DocumentProcessingError("This file is not a readable PDF. Please upload a valid, uncorrupted PDF.") from exc
    try:
        if doc.is_encrypted and not doc.authenticate(""):
            raise DocumentProcessingError("This PDF is password-protected. Remove its password and upload it again.")
        total_pages = len(doc)
        if not total_pages:
            raise DocumentProcessingError("This PDF has no pages to process.")
        chunk_tokens = max(200, int(os.getenv("RAG_CHUNK_SIZE_TOKENS", "850")))
        overlap_tokens = max(0, min(chunk_tokens // 4, int(os.getenv("RAG_CHUNK_OVERLAP_TOKENS", "100"))))
        chars_per_token = max(2, int(os.getenv("RAG_CHARS_PER_TOKEN", "3")))
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_tokens * chars_per_token, chunk_overlap=overlap_tokens * chars_per_token,
            separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""], strip_whitespace=True,
        )
        chunks = []
        total_chars = 0
        for page_index in range(total_pages):
            try:
                text = _normalize_page_text(doc.load_page(page_index).get_text("text") or "")
            except Exception as exc:
                raise DocumentProcessingError(f"Could not extract page {page_index + 1} from this PDF.") from exc
            if not text:
                continue
            total_chars += len(text)
            metadata = {
                "document_id": document_id, "filename": filename,
                "owner_id": str(owner_id) if owner_id is not None else "",
                "page": page_index + 1, "page_start": page_index + 1, "page_end": page_index + 1,
                "total_pages": total_pages, "uploaded_at": uploaded_at,
            }
            for piece in splitter.split_text(text):
                if piece.strip():
                    chunks.append(Document(page_content=piece.strip(), metadata={**metadata, "chunk_index": len(chunks)}))
                    if len(chunks) > max_chunks:
                        raise DocumentProcessingError(
                            f"This PDF exceeds the synchronous indexing limit of {max_chunks} chunks. Split it into smaller files and upload each section."
                        )
            del text
        if total_chars < int(os.getenv("PDF_MIN_EXTRACTABLE_CHARS", "40")):
            raise DocumentProcessingError(
                "This PDF contains too little selectable text. It may be scanned or image-based; OCR is required before it can be studied."
            )
        if not chunks:
            raise DocumentProcessingError("No searchable text could be created from this PDF.")
        return chunks, total_pages
    finally:
        doc.close()


def split_plain_text(text: str, *, chunk_size_tokens: int = 1500, overlap_tokens: int = 100) -> list[str]:
    """Conservative character approximation for text splitting when no tokenizer is installed."""
    if not text or not text.strip():
        return []
    chars_per_token = max(2, int(os.getenv("RAG_CHARS_PER_TOKEN", "3")))
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size_tokens * chars_per_token,
        chunk_overlap=min(overlap_tokens, chunk_size_tokens // 4) * chars_per_token,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
        strip_whitespace=True,
    )
    return [part for part in splitter.split_text(text) if part.strip()]


def extract_pdf_text(file_bytes: bytes) -> tuple[str, int]:
    """Compatibility helper for /extract-pdf; page markers retain provenance in the same text field."""
    pages, total_pages = extract_pdf_pages(file_bytes)
    return "\n\n".join(f"[Page {page['page']}]\n{page['text']}" for page in pages), total_pages
