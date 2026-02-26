from __future__ import annotations

import re
import uuid
from unittest.mock import patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.quiz import Quiz, QuizItem
from app.models.user import User
from app.services.share_service import (
    duplicate_quiz_for_user,
    ensure_unique_share_code,
    generate_share_code,
    get_shared_quiz,
)

# ── helpers ──────────────────────────────────────────────────


async def _create_shared_quiz(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_shared: bool = True,
    share_code: str = "abc12345",
    n_items: int = 2,
) -> tuple[Document, Quiz, list[QuizItem]]:
    doc = Document(
        owner_id=user_id,
        title="Shared Doc",
        source_type="text",
        char_count=100,
    )
    db.add(doc)
    await db.flush()

    quiz = Quiz(
        document_id=doc.id,
        title="Shared Quiz",
        item_count=n_items,
        is_shared=is_shared,
        share_code=share_code,
    )
    db.add(quiz)
    await db.flush()

    items: list[QuizItem] = []
    for i in range(n_items):
        item = QuizItem(
            quiz_id=quiz.id,
            quiz_type="mcq",
            question=f"Question {i + 1}?",
            correct_answer="A",
            explanation=f"Explanation {i + 1}",
            options={"A": "opt_a", "B": "opt_b"},
            concept_tags=["tag1", "tag2"],
            difficulty=i + 1,
        )
        db.add(item)
        items.append(item)
    await db.flush()

    return doc, quiz, items


# ── generate_share_code ──────────────────────────────────────


class TestGenerateShareCode:
    def test_returns_8_characters(self) -> None:
        code = generate_share_code()
        assert len(code) == 8

    def test_alphanumeric_only(self) -> None:
        code = generate_share_code()
        assert re.fullmatch(r"[A-Za-z0-9]+", code) is not None

    def test_two_calls_produce_different_codes(self) -> None:
        codes = {generate_share_code() for _ in range(10)}
        assert len(codes) > 1


# ── ensure_unique_share_code ─────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestEnsureUniqueShareCode:
    async def test_returns_unique_code(self, db_session: AsyncSession) -> None:
        code = await ensure_unique_share_code(db_session)
        assert len(code) == 8

    async def test_retries_on_collision(self, db_session: AsyncSession, seeded_user: User) -> None:
        # Create a quiz with a known share code
        _, _, _ = await _create_shared_quiz(db_session, seeded_user.id, share_code="EXISTING")

        call_count = 0

        def mock_generate() -> str:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "EXISTING"  # collides
            return "NEWCODE1"  # unique

        with patch("app.services.share_service.generate_share_code", side_effect=mock_generate):
            code = await ensure_unique_share_code(db_session)

        assert code == "NEWCODE1"
        assert call_count == 2

    async def test_raises_after_10_attempts(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(db_session, seeded_user.id, share_code="COLLIDER")

        with (
            patch(
                "app.services.share_service.generate_share_code",
                return_value="COLLIDER",
            ),
            pytest.raises(RuntimeError, match="10 attempts"),
        ):
            await ensure_unique_share_code(db_session)


# ── get_shared_quiz ──────────────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestGetSharedQuiz:
    async def test_returns_quiz_when_shared(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, _ = await _create_shared_quiz(db_session, seeded_user.id, share_code="SHARED01")

        result = await get_shared_quiz(db_session, "SHARED01")
        assert result is not None
        assert result.id == quiz.id

    async def test_returns_none_when_not_shared(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        await _create_shared_quiz(
            db_session, seeded_user.id, is_shared=False, share_code="HIDDEN01"
        )

        result = await get_shared_quiz(db_session, "HIDDEN01")
        assert result is None

    async def test_returns_none_for_nonexistent_code(self, db_session: AsyncSession) -> None:
        result = await get_shared_quiz(db_session, "NOTEXIST")
        assert result is None

    async def test_eager_loads_items_and_document(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(
            db_session, seeded_user.id, share_code="LOADED01", n_items=3
        )

        result = await get_shared_quiz(db_session, "LOADED01")
        assert result is not None
        assert len(result.items) == 3
        assert result.document is not None
        assert result.document.title == "Shared Doc"


# ── duplicate_quiz_for_user ──────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestDuplicateQuizForUser:
    async def test_creates_document_with_shared_prefix(
        self, db_session: AsyncSession, seeded_user: User, second_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(db_session, seeded_user.id, share_code="DUP00001")
        # Eager load for duplicate
        source = await get_shared_quiz(db_session, "DUP00001")
        assert source is not None

        new_doc, _ = await duplicate_quiz_for_user(db_session, source, second_user.id)
        assert new_doc.title.startswith("[공유]")
        assert new_doc.owner_id == second_user.id
        assert new_doc.source_type == "shared"

    async def test_copies_all_items(
        self, db_session: AsyncSession, seeded_user: User, second_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(
            db_session, seeded_user.id, share_code="DUP00002", n_items=3
        )
        source = await get_shared_quiz(db_session, "DUP00002")
        assert source is not None

        _, new_quiz = await duplicate_quiz_for_user(db_session, source, second_user.id)
        assert new_quiz.item_count == 3

        # Verify items were created
        from sqlalchemy import select

        stmt = select(QuizItem).where(QuizItem.quiz_id == new_quiz.id)
        result = await db_session.execute(stmt)
        new_items = list(result.scalars().all())
        assert len(new_items) == 3

    async def test_preserves_item_fields(
        self, db_session: AsyncSession, seeded_user: User, second_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(
            db_session, seeded_user.id, share_code="DUP00003", n_items=1
        )
        source = await get_shared_quiz(db_session, "DUP00003")
        assert source is not None

        _, new_quiz = await duplicate_quiz_for_user(db_session, source, second_user.id)

        from sqlalchemy import select

        stmt = select(QuizItem).where(QuizItem.quiz_id == new_quiz.id)
        result = await db_session.execute(stmt)
        new_item = result.scalar_one()

        assert new_item.question == "Question 1?"
        assert new_item.correct_answer == "A"
        assert new_item.options == {"A": "opt_a", "B": "opt_b"}
        assert new_item.concept_tags == ["tag1", "tag2"]

    async def test_sets_source_chunk_id_to_none(
        self, db_session: AsyncSession, seeded_user: User, second_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(
            db_session, seeded_user.id, share_code="DUP00004", n_items=1
        )
        source = await get_shared_quiz(db_session, "DUP00004")
        assert source is not None

        _, new_quiz = await duplicate_quiz_for_user(db_session, source, second_user.id)

        from sqlalchemy import select

        stmt = select(QuizItem).where(QuizItem.quiz_id == new_quiz.id)
        result = await db_session.execute(stmt)
        new_item = result.scalar_one()
        assert new_item.source_chunk_id is None

    async def test_new_quiz_title_matches_source(
        self, db_session: AsyncSession, seeded_user: User, second_user: User
    ) -> None:
        _, _, _ = await _create_shared_quiz(db_session, seeded_user.id, share_code="DUP00005")
        source = await get_shared_quiz(db_session, "DUP00005")
        assert source is not None

        _, new_quiz = await duplicate_quiz_for_user(db_session, source, second_user.id)
        assert new_quiz.title == source.title
