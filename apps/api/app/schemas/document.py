from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ChunkResponse(BaseModel):
    id: uuid.UUID
    index: int
    content: str
    token_count: int


class DocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    source_type: str
    char_count: int
    chunk_count: int
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    chunks: list[ChunkResponse]
