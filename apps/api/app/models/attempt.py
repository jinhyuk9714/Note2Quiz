from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.dialects.postgresql import JSONB as _PGJSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON as _StdJSON

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.quiz import Quiz, QuizItem
    from app.models.user import User

# JSONB on PostgreSQL, plain JSON on SQLite (tests)
_JSONBCompat = _StdJSON().with_variant(_PGJSONB(), "postgresql")


class QuizAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quiz_attempts"
    __table_args__ = (
        Index("ix_quiz_attempts_user_quiz_created", "user_id", "quiz_id", "created_at"),
        Index("ix_quiz_attempts_user_created", "user_id", "created_at"),
    )

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)
    score: Mapped[int] = mapped_column(Integer)
    total: Mapped[int] = mapped_column(Integer)
    answers: Mapped[list[dict[str, Any]]] = mapped_column(JSON)

    quiz: Mapped[Quiz] = relationship(back_populates="attempts")
    user: Mapped[User] = relationship(back_populates="quiz_attempts")
    wrong_answer_notes: Mapped[list[WrongAnswerNote]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class WrongAnswerNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "wrong_answer_notes"
    __table_args__ = (
        UniqueConstraint("user_id", "quiz_item_id", name="uq_wrong_note_user_item"),
        Index("ix_wrong_notes_user_mastered_review", "user_id", "is_mastered", "next_review_at"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    quiz_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_items.id", ondelete="CASCADE"), index=True
    )

    user_answer: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    wrong_reason: Mapped[str] = mapped_column(Text)
    concept_tags: Mapped[list[str]] = mapped_column(_JSONBCompat, default=list)

    # SRS fields
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_correct: Mapped[int] = mapped_column(Integer, default=0)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_mastered: Mapped[bool] = mapped_column(Boolean, default=False)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5, server_default="2.5")
    interval_days: Mapped[int] = mapped_column(Integer, default=1, server_default="1")

    attempt: Mapped[QuizAttempt] = relationship(back_populates="wrong_answer_notes")
    user: Mapped[User] = relationship(back_populates="wrong_answer_notes")
    quiz_item: Mapped[QuizItem] = relationship()
