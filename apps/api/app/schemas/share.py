from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel


class ShareToggleRequest(BaseModel):
    """Toggle sharing on/off for a quiz."""

    is_shared: bool


class ShareInfoResponse(BaseModel):
    """Returned when owner requests share status of their quiz."""

    quiz_id: uuid.UUID
    is_shared: bool
    share_code: str | None
    share_url: str | None


class SharedQuizItemResponse(BaseModel):
    """Quiz item without answers — safe for shared quiz pre-submission view."""

    id: uuid.UUID
    quiz_type: str
    question: str
    options: dict[str, str] | None = None
    concept_tags: list[str]
    difficulty: int


class SharedQuizResponse(BaseModel):
    """Public quiz data for shared link recipients (items without answers)."""

    id: uuid.UUID
    title: str
    item_count: int
    created_at: datetime
    owner_display_name: str
    items: list[SharedQuizItemResponse]


class QuizCopyResponse(BaseModel):
    """Returned after duplicating a shared quiz into user's account."""

    quiz_id: uuid.UUID
    document_id: uuid.UUID
    title: str
    item_count: int
