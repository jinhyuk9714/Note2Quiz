from __future__ import annotations

import logging
import secrets
import string
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.document import Document
from app.models.quiz import Quiz, QuizItem

logger = logging.getLogger(__name__)

_SHARE_CODE_ALPHABET = string.ascii_letters + string.digits
_SHARE_CODE_LENGTH = 8


def generate_share_code() -> str:
    """Generate a URL-safe, 8-character share code (base62)."""
    return "".join(secrets.choice(_SHARE_CODE_ALPHABET) for _ in range(_SHARE_CODE_LENGTH))


async def ensure_unique_share_code(db: AsyncSession) -> str:
    """Generate a share code that does not collide with existing ones."""
    for _ in range(10):
        code = generate_share_code()
        stmt = select(Quiz.id).where(Quiz.share_code == code)
        result = await db.execute(stmt)
        if result.scalar_one_or_none() is None:
            return code
    msg = "Failed to generate unique share code after 10 attempts"
    raise RuntimeError(msg)


async def get_shared_quiz(db: AsyncSession, share_code: str) -> Quiz | None:
    """Retrieve a quiz by its share code, only if sharing is enabled."""
    stmt = (
        select(Quiz)
        .where(Quiz.share_code == share_code, Quiz.is_shared.is_(True))
        .options(selectinload(Quiz.items), selectinload(Quiz.document))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def duplicate_quiz_for_user(
    db: AsyncSession,
    source_quiz: Quiz,
    target_user_id: uuid.UUID,
) -> tuple[Document, Quiz]:
    """Create a copy of the quiz under a new Document owned by target_user_id."""
    logger.info("Duplicating quiz=%s for user=%s", source_quiz.id, target_user_id)
    doc_title = source_quiz.document.title if source_quiz.document else source_quiz.title
    new_doc = Document(
        owner_id=target_user_id,
        title=f"[공유] {doc_title}",
        source_type="shared",
        char_count=0,
        chunk_count=0,
    )
    db.add(new_doc)
    await db.flush()

    new_quiz = Quiz(
        document_id=new_doc.id,
        title=source_quiz.title,
        item_count=source_quiz.item_count,
    )
    db.add(new_quiz)
    await db.flush()

    for item in source_quiz.items:
        new_item = QuizItem(
            quiz_id=new_quiz.id,
            source_chunk_id=None,
            quiz_type=item.quiz_type,
            question=item.question,
            correct_answer=item.correct_answer,
            explanation=item.explanation,
            options=item.options,
            concept_tags=item.concept_tags,
            difficulty=item.difficulty,
        )
        db.add(new_item)

    await db.flush()
    return new_doc, new_quiz
