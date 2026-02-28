from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AnswerItem(BaseModel):
    quiz_item_id: uuid.UUID
    user_answer: str = Field(max_length=1000)


class QuizSubmitRequest(BaseModel):
    answers: list[AnswerItem] = Field(min_length=1)

    @field_validator("answers")
    @classmethod
    def validate_unique_quiz_item_ids(cls, v: list[AnswerItem]) -> list[AnswerItem]:
        seen: set[uuid.UUID] = set()
        for answer in v:
            if answer.quiz_item_id in seen:
                msg = f"Duplicate quiz_item_id '{answer.quiz_item_id}' in answers"
                raise ValueError(msg)
            seen.add(answer.quiz_item_id)
        return v


class AnswerResult(BaseModel):
    quiz_item_id: uuid.UUID
    user_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str
    grading_method: str | None = None


class QuizSubmitResponse(BaseModel):
    attempt_id: uuid.UUID
    attempt_number: int
    score: int
    total: int
    results: list[AnswerResult]
    wrong_notes_created: int
    wrong_notes_updated: int = 0


class WrongAnswerNoteResponse(BaseModel):
    id: uuid.UUID
    quiz_item_id: uuid.UUID
    question: str
    user_answer: str
    correct_answer: str
    wrong_reason: str
    concept_tags: list[str]
    next_review_at: datetime | None
    consecutive_correct: int
    is_mastered: bool
    ease_factor: float
    interval_days: int
    created_at: datetime


class WrongAnswerNoteReviewRequest(BaseModel):
    quality: Literal[1, 3, 5]


class WrongAnswerNoteListResponse(BaseModel):
    notes: list[WrongAnswerNoteResponse]
    total: int
    limit: int = 50
    offset: int = 0
