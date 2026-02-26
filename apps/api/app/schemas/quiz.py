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


class QuizItemStudyResponse(BaseModel):
    """Quiz item with correct_answer + explanation — for flashcard/study mode."""

    id: uuid.UUID
    quiz_type: str
    question: str
    correct_answer: str
    explanation: str
    options: dict[str, str] | None = None
    concept_tags: list[str]
    difficulty: int


class QuizStudyResponse(BaseModel):
    """Full quiz with answers exposed — for flashcard/study mode."""

    id: uuid.UUID
    title: str
    item_count: int
    created_at: datetime
    items: list[QuizItemStudyResponse]


class QuizUpdateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)


class QuizItemUpdateRequest(BaseModel):
    """Partial update — only provided fields are updated."""

    question: str | None = Field(default=None, min_length=1)
    correct_answer: str | None = Field(default=None, min_length=1)
    explanation: str | None = Field(default=None, min_length=1)
    options: dict[str, str] | None = None
    concept_tags: list[str] | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)

    @field_validator("concept_tags")
    @classmethod
    def validate_concept_tags(cls, v: list[str] | None) -> list[str] | None:
        if v is not None:
            if len(v) > 5:
                msg = "At most 5 concept tags allowed"
                raise ValueError(msg)
            v = [tag.strip() for tag in v if tag.strip()]
        return v


class QuizItemCreateRequest(BaseModel):
    quiz_type: str
    question: str = Field(min_length=1)
    correct_answer: str = Field(min_length=1)
    explanation: str = Field(min_length=1)
    options: dict[str, str] | None = None
    concept_tags: list[str] = Field(default_factory=list)
    difficulty: int = Field(default=3, ge=1, le=5)

    @field_validator("quiz_type")
    @classmethod
    def validate_quiz_type(cls, v: str) -> str:
        if v not in _VALID_QUIZ_TYPES:
            msg = f"Invalid quiz type '{v}'. Must be one of: {', '.join(sorted(_VALID_QUIZ_TYPES))}"
            raise ValueError(msg)
        return v

    @field_validator("concept_tags")
    @classmethod
    def validate_concept_tags(cls, v: list[str]) -> list[str]:
        if len(v) > 5:
            msg = "At most 5 concept tags allowed"
            raise ValueError(msg)
        return [tag.strip() for tag in v if tag.strip()]


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
    is_shared: bool = False


class QuizResponse(BaseModel):
    id: uuid.UUID
    title: str
    item_count: int
    created_at: datetime
    items: list[QuizItemPublicResponse]
    is_shared: bool = False
    share_code: str | None = None


class QuizAttemptSummaryResponse(BaseModel):
    attempt_id: uuid.UUID
    attempt_number: int
    score: int
    total: int
    created_at: datetime


class AttemptItemResult(BaseModel):
    """Per-item result for a past attempt, combining attempt.answers with QuizItem data."""

    quiz_item_id: uuid.UUID
    quiz_type: str
    question: str
    user_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    grading_method: str | None
    concept_tags: list[str]
    difficulty: int
    options: dict[str, str] | None


class AttemptDetailResponse(BaseModel):
    """Full attempt result with per-item data — for the attempt detail page."""

    attempt_id: uuid.UUID
    attempt_number: int
    score: int
    total: int
    created_at: datetime
    quiz_id: uuid.UUID
    quiz_title: str
    results: list[AttemptItemResult]


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
