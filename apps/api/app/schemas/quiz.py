from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class QuizGenerateRequest(BaseModel):
    document_id: uuid.UUID
    chunk_ids: list[uuid.UUID] | None = None
    n_questions: int = Field(default=5, ge=1, le=20)
    quiz_types: list[str] = Field(default=["mcq", "short_answer"])


class QuizItemResponse(BaseModel):
    id: uuid.UUID
    quiz_type: str
    question: str
    correct_answer: str
    explanation: str
    options: dict[str, str] | None = None
    concept_tags: list[str]
    difficulty: int


class QuizListItemResponse(BaseModel):
    id: uuid.UUID
    title: str
    item_count: int
    document_id: uuid.UUID
    created_at: datetime


class QuizResponse(BaseModel):
    id: uuid.UUID
    title: str
    item_count: int
    created_at: datetime
    items: list[QuizItemResponse]
