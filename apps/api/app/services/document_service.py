from __future__ import annotations

import hashlib
import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import Chunk
from app.models.document import Document


def normalize_text(raw: str) -> str:
    text = re.sub(r"\r\n", "\n", raw)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, handling both Korean and English.

    Phase 1: split on newlines (primary boundary in Korean PDFs).
    Phase 2: within each paragraph, split on sentence-ending punctuation.
    """
    paragraphs = re.split(r"\n+", text)
    sentences: list[str] = []
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue
        parts = re.split(r"(?<=[.!?。])\s*", para)
        for part in parts:
            stripped = part.strip()
            if stripped:
                sentences.append(stripped)
    return sentences


def split_into_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into chunks by character count (not word count)."""
    sentences = _split_sentences(text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        char_count = len(sentence)
        if current_len + char_count > chunk_size and current:
            chunks.append(" ".join(current))
            overlap_sentences: list[str] = []
            overlap_len = 0
            for s in reversed(current):
                cc = len(s)
                if overlap_len + cc > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_len += cc
            current = overlap_sentences
            current_len = overlap_len
        current.append(sentence)
        current_len += char_count

    if current:
        chunks.append(" ".join(current))

    return chunks


def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def create_document_with_chunks(
    db: AsyncSession,
    owner_id: uuid.UUID,
    title: str,
    raw_text: str,
    source_type: str = "text",
    folder_id: uuid.UUID | None = None,
) -> Document:
    normalized = normalize_text(raw_text)
    chunk_texts = split_into_chunks(
        normalized,
        chunk_size=settings.default_chunk_size,
        overlap=settings.default_chunk_overlap,
    )

    doc = Document(
        owner_id=owner_id,
        title=title,
        source_type=source_type,
        char_count=len(normalized),
        chunk_count=len(chunk_texts),
        folder_id=folder_id,
    )
    db.add(doc)
    await db.flush()

    for i, text in enumerate(chunk_texts):
        chunk = Chunk(
            document_id=doc.id,
            index=i,
            content=text,
            content_hash=compute_hash(text),
            token_count=len(text),  # character count
        )
        db.add(chunk)

    return doc
