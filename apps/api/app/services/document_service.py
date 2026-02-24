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


def split_into_chunks(text: str, chunk_size: int, overlap: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?。])\s+", text)
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        word_count = len(sentence.split())
        if current_len + word_count > chunk_size and current:
            chunks.append(" ".join(current))
            # Keep overlap
            overlap_sentences: list[str] = []
            overlap_len = 0
            for s in reversed(current):
                wc = len(s.split())
                if overlap_len + wc > overlap:
                    break
                overlap_sentences.insert(0, s)
                overlap_len += wc
            current = overlap_sentences
            current_len = overlap_len
        current.append(sentence)
        current_len += word_count

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
    )
    db.add(doc)
    await db.flush()

    for i, text in enumerate(chunk_texts):
        chunk = Chunk(
            document_id=doc.id,
            index=i,
            content=text,
            content_hash=compute_hash(text),
            token_count=len(text.split()),
        )
        db.add(chunk)

    return doc
