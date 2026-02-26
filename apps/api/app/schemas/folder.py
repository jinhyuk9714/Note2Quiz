from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FolderCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str | None = Field(default=None, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    emoji: str | None = Field(default=None, max_length=10)


class FolderUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    color: str | None = None
    emoji: str | None = None


class FolderResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str | None
    emoji: str | None
    document_count: int = 0
    created_at: datetime


class DocumentMoveRequest(BaseModel):
    folder_id: uuid.UUID | None = None
