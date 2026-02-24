from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DocumentUploadRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    text: str = Field(min_length=10, description="원문 텍스트 (또는 PDF 추출 텍스트)")


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
