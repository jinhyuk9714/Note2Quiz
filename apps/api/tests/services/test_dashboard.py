from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import Quiz, QuizItem
from app.models.user import User
from app.services.dashboard_service import (
    _get_mastery_summary,  # pyright: ignore[reportPrivateUsage]
    _get_streak_stats,  # pyright: ignore[reportPrivateUsage]
)


async def _create_quiz_with_item(db: AsyncSession, user_id: uuid.UUID) -> tuple[Quiz, QuizItem]:
    """Create a minimal quiz + quiz_item for testing."""
    from app.models.document import Document

    doc = Document(
        owner_id=user_id,
        title="Test Doc",
        source_type="text",
        char_count=100,
    )
    db.add(doc)
    await db.flush()

    quiz = Quiz(
        document_id=doc.id,
        title="Test Quiz",
        item_count=1,
    )
    db.add(quiz)
    await db.flush()

    item = QuizItem(
        quiz_id=quiz.id,
        quiz_type="mcq",
        question="Q?",
        correct_answer="A",
        explanation="E",
        options={"A": "a"},
        concept_tags=["test"],
        difficulty=1,
    )
    db.add(item)
    await db.flush()

    return quiz, item


async def _create_attempt_on_date(
    db: AsyncSession,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    target_date: datetime,
    attempt_number: int = 1,
) -> QuizAttempt:
    """Create a quiz attempt with a specific created_at date."""
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        attempt_number=attempt_number,
        score=1,
        total=1,
        answers=[],
    )
    db.add(attempt)
    await db.flush()
    # Override created_at after flush
    attempt.created_at = target_date  # type: ignore[assignment]
    await db.flush()
    return attempt


@pytest.mark.usefixtures("setup_database")
class TestGetStreakStats:
    async def test_no_activity(self, db_session: AsyncSession, seeded_user: User) -> None:
        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 0
        assert result.longest_streak_days == 0
        assert result.total_active_days == 0
        assert result.last_activity_date is None

    async def test_today_only(self, db_session: AsyncSession, seeded_user: User) -> None:
        quiz, _ = await _create_quiz_with_item(db_session, seeded_user.id)
        now = datetime.now(UTC)
        await _create_attempt_on_date(db_session, seeded_user.id, quiz.id, now)

        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 1
        assert result.longest_streak_days == 1
        assert result.total_active_days == 1

    async def test_consecutive_three_days(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        quiz, _ = await _create_quiz_with_item(db_session, seeded_user.id)
        now = datetime.now(UTC)
        for i in range(3):
            await _create_attempt_on_date(
                db_session,
                seeded_user.id,
                quiz.id,
                now - timedelta(days=i),
                attempt_number=i + 1,
            )

        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 3
        assert result.longest_streak_days == 3
        assert result.total_active_days == 3

    async def test_streak_broken(self, db_session: AsyncSession, seeded_user: User) -> None:
        """Last activity was 3 days ago, so current streak should be 0."""
        quiz, _ = await _create_quiz_with_item(db_session, seeded_user.id)
        now = datetime.now(UTC)
        await _create_attempt_on_date(db_session, seeded_user.id, quiz.id, now - timedelta(days=3))

        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 0
        assert result.longest_streak_days == 1
        assert result.total_active_days == 1

    async def test_gap_in_activity(self, db_session: AsyncSession, seeded_user: User) -> None:
        """Activity on days 0,1,2 (current) and 5,6,7 (past). Longest=3, current=3."""
        quiz, _ = await _create_quiz_with_item(db_session, seeded_user.id)
        now = datetime.now(UTC)
        # Current streak: today, yesterday, 2 days ago
        for i in range(3):
            await _create_attempt_on_date(
                db_session, seeded_user.id, quiz.id, now - timedelta(days=i), i + 1
            )
        # Past streak: 5, 6, 7 days ago (also 3 days)
        for i in range(5, 8):
            await _create_attempt_on_date(
                db_session, seeded_user.id, quiz.id, now - timedelta(days=i), i + 1
            )

        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 3
        assert result.longest_streak_days == 3
        assert result.total_active_days == 6

    async def test_yesterday_continues_streak(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        """Activity yesterday but not today — streak should still count."""
        quiz, _ = await _create_quiz_with_item(db_session, seeded_user.id)
        now = datetime.now(UTC)
        await _create_attempt_on_date(db_session, seeded_user.id, quiz.id, now - timedelta(days=1))
        await _create_attempt_on_date(
            db_session, seeded_user.id, quiz.id, now - timedelta(days=2), 2
        )

        result = await _get_streak_stats(db_session, seeded_user.id)
        assert result.current_streak_days == 2
        assert result.longest_streak_days == 2


@pytest.mark.usefixtures("setup_database")
class TestGetMasterySummary:
    async def test_no_notes(self, db_session: AsyncSession, seeded_user: User) -> None:
        result = await _get_mastery_summary(db_session, seeded_user.id)
        assert result.total_wrong_notes == 0
        assert result.mastered_count == 0
        assert result.mastery_rate == 0.0

    async def test_partial_mastery(self, db_session: AsyncSession, seeded_user: User) -> None:
        quiz, item = await _create_quiz_with_item(db_session, seeded_user.id)
        attempt = QuizAttempt(
            user_id=seeded_user.id,
            quiz_id=quiz.id,
            attempt_number=1,
            score=0,
            total=1,
            answers=[],
        )
        db_session.add(attempt)
        await db_session.flush()

        for i in range(5):
            note = WrongAnswerNote(
                attempt_id=attempt.id,
                user_id=seeded_user.id,
                quiz_item_id=item.id,
                user_answer="wrong",
                correct_answer="right",
                wrong_reason="reason",
                concept_tags=["tag"],
                is_mastered=i < 2,  # 2 mastered, 3 not
            )
            db_session.add(note)
        await db_session.flush()

        result = await _get_mastery_summary(db_session, seeded_user.id)
        assert result.total_wrong_notes == 5
        assert result.mastered_count == 2
        assert result.mastery_rate == 0.4

    async def test_all_mastered(self, db_session: AsyncSession, seeded_user: User) -> None:
        quiz, item = await _create_quiz_with_item(db_session, seeded_user.id)
        attempt = QuizAttempt(
            user_id=seeded_user.id,
            quiz_id=quiz.id,
            attempt_number=1,
            score=0,
            total=1,
            answers=[],
        )
        db_session.add(attempt)
        await db_session.flush()

        for _ in range(3):
            note = WrongAnswerNote(
                attempt_id=attempt.id,
                user_id=seeded_user.id,
                quiz_item_id=item.id,
                user_answer="wrong",
                correct_answer="right",
                wrong_reason="reason",
                concept_tags=["tag"],
                is_mastered=True,
            )
            db_session.add(note)
        await db_session.flush()

        result = await _get_mastery_summary(db_session, seeded_user.id)
        assert result.total_wrong_notes == 3
        assert result.mastered_count == 3
        assert result.mastery_rate == 1.0
