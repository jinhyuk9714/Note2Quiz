from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)


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
    quiz_count: int = 0
    created_at: datetime


class DocumentDetailResponse(DocumentResponse):
    chunks: list[ChunkResponse]
