from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class AnswerItem(BaseModel):
    quiz_item_id: uuid.UUID
    user_answer: str


class QuizSubmitRequest(BaseModel):
    answers: list[AnswerItem] = Field(min_length=1)


class AnswerResult(BaseModel):
    quiz_item_id: uuid.UUID
    user_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str


class QuizSubmitResponse(BaseModel):
    attempt_id: uuid.UUID
    score: int
    total: int
    results: list[AnswerResult]
    wrong_notes_created: int


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
    created_at: datetime


class WrongAnswerNoteListResponse(BaseModel):
    notes: list[WrongAnswerNoteResponse]
    total: int
