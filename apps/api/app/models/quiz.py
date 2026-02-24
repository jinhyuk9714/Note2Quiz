from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.attempt import QuizAttempt
    from app.models.chunk import Chunk
    from app.models.document import Document


class QuizType(enum.StrEnum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"
    TRUE_FALSE = "true_false"
    FILL_BLANK = "fill_blank"


class Quiz(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quizzes"

    document_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("documents.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    item_count: Mapped[int] = mapped_column(Integer)

    document: Mapped[Document] = relationship()
    items: Mapped[list[QuizItem]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )
    attempts: Mapped[list[QuizAttempt]] = relationship(back_populates="quiz")


class QuizItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quiz_items"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True
    )
    quiz_type: Mapped[QuizType] = mapped_column(Enum(QuizType))
    question: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    options: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    concept_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)

    quiz: Mapped[Quiz] = relationship(back_populates="items")
    source_chunk: Mapped[Chunk | None] = relationship(back_populates="quiz_items")
