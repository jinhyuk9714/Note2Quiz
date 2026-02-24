from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.quiz import QuizType

_VALID_QUIZ_TYPES = {t.value for t in QuizType}


class QuizGenerateRequest(BaseModel):
    document_id: uuid.UUID
    chunk_ids: list[uuid.UUID] | None = None
    n_questions: int = Field(default=5, ge=1, le=20)
    quiz_types: list[str] = Field(default=["mcq", "short_answer"])

    @field_validator("quiz_types")
    @classmethod
    def validate_quiz_types(cls, v: list[str]) -> list[str]:
        for qt in v:
            if qt not in _VALID_QUIZ_TYPES:
                msg = f"Invalid quiz type '{qt}'. Must be one of: {', '.join(sorted(_VALID_QUIZ_TYPES))}"
                raise ValueError(msg)
        return v


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
