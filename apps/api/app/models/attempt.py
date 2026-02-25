from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.quiz import Quiz, QuizItem
    from app.models.user import User


class QuizAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quiz_attempts"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
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

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    quiz_item_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_items.id", ondelete="CASCADE"), index=True
    )

    user_answer: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    wrong_reason: Mapped[str] = mapped_column(Text)
    concept_tags: Mapped[list[str]] = mapped_column(JSON, default=list)

    # SRS fields
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    consecutive_correct: Mapped[int] = mapped_column(Integer, default=0)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_mastered: Mapped[bool] = mapped_column(Boolean, default=False)

    attempt: Mapped[QuizAttempt] = relationship(back_populates="wrong_answer_notes")
    user: Mapped[User] = relationship(back_populates="wrong_answer_notes")
    quiz_item: Mapped[QuizItem] = relationship()
