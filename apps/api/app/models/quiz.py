from __future__ import annotations

import enum
import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.dialects.postgresql import JSONB as _PGJSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON as _StdJSON

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.attempt import QuizAttempt
    from app.models.chunk import Chunk
    from app.models.document import Document

# JSONB on PostgreSQL, plain JSON on SQLite (tests)
_JSONBCompat = _StdJSON().with_variant(_PGJSONB(), "postgresql")


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
    share_code: Mapped[str | None] = mapped_column(
        String(12), unique=True, index=True, nullable=True, default=None
    )
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    document: Mapped[Document] = relationship(back_populates="quizzes")
    items: Mapped[list[QuizItem]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )
    attempts: Mapped[list[QuizAttempt]] = relationship(
        back_populates="quiz", cascade="all, delete-orphan"
    )


class QuizItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quiz_items"

    quiz_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quizzes.id", ondelete="CASCADE"), index=True
    )
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("chunks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    quiz_type: Mapped[QuizType] = mapped_column(Enum(QuizType))
    question: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str] = mapped_column(Text)
    options: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    concept_tags: Mapped[list[str]] = mapped_column(_JSONBCompat, default=list)
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    source_unit_ids: Mapped[list[str]] = mapped_column(_JSONBCompat, default=list)

    quiz: Mapped[Quiz] = relationship(back_populates="items")
    source_chunk: Mapped[Chunk | None] = relationship(back_populates="quiz_items")
