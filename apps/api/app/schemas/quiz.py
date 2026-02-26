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
    title: str | None = Field(default=None, max_length=500)
    focus_concepts: list[str] | None = Field(default=None)

    @field_validator("quiz_types")
    @classmethod
    def validate_quiz_types(cls, v: list[str]) -> list[str]:
        for qt in v:
            if qt not in _VALID_QUIZ_TYPES:
                msg = f"Invalid quiz type '{qt}'. Must be one of: {', '.join(sorted(_VALID_QUIZ_TYPES))}"
                raise ValueError(msg)
        return v

    @field_validator("focus_concepts")
    @classmethod
    def validate_focus_concepts(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            if len(v) > 5:
                msg = "At most 5 focus concepts allowed"
                raise ValueError(msg)
            v = [tag.strip() for tag in v if tag.strip()]
            if not v:
                return None
        return v


class QuizItemPublicResponse(BaseModel):
    """Quiz item without correct_answer/explanation — safe to send before submission."""

    id: uuid.UUID
    quiz_type: str
    question: str
    options: dict[str, str] | None = None
    concept_tags: list[str]
    difficulty: int


class QuizListItemResponse(BaseModel):
    id: uuid.UUID
    title: str
    item_count: int
    document_id: uuid.UUID
    document_title: str
    created_at: datetime
    attempt_count: int = 0
    latest_score: int | None = None
    latest_total: int | None = None


class QuizResponse(BaseModel):
    id: uuid.UUID
    title: str
    item_count: int
    created_at: datetime
    items: list[QuizItemPublicResponse]


class QuizAttemptSummaryResponse(BaseModel):
    attempt_id: uuid.UUID
    attempt_number: int
    score: int
    total: int
    created_at: datetime


# SSE streaming event payloads


class QuizStreamProgress(BaseModel):
    step: str  # "analyzing" | "saving"
    current: int
    total: int
    message: str


class QuizStreamComplete(BaseModel):
    quiz_id: uuid.UUID
    item_count: int


class QuizStreamError(BaseModel):
    message: str
