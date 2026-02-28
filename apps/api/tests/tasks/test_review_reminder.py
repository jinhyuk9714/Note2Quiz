from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import Quiz, QuizItem, QuizType
from app.models.user import User
from app.services.auth_service import hash_password
from app.tasks.review_reminder import send_review_reminders
from tests.conftest import TEST_USER_ID


async def _seed_user_with_due_notes(db: AsyncSession) -> User:
    """Create a user with wrong notes due for review."""
    from app.models.document import Document

    user = User(
        id=TEST_USER_ID,
        email="reminder@example.com",
        display_name="Reminder User",
        hashed_password=hash_password("testpassword123"),
    )
    db.add(user)
    await db.flush()

    doc = Document(
        owner_id=user.id, title="Test Doc", source_type="text", char_count=12, chunk_count=1
    )
    db.add(doc)
    await db.flush()

    from app.models.chunk import Chunk

    chunk = Chunk(
        document_id=doc.id, index=0, content="test chunk", content_hash="abc", token_count=2
    )
    db.add(chunk)
    await db.flush()

    quiz = Quiz(document_id=doc.id, title="Test Quiz", item_count=1)
    db.add(quiz)
    await db.flush()

    item = QuizItem(
        quiz_id=quiz.id,
        source_chunk_id=chunk.id,
        quiz_type=QuizType.MCQ,
        question="Q?",
        correct_answer="A",
        explanation="Because A.",
        options={"A": "a", "B": "b", "C": "c", "D": "d"},
        concept_tags=["test"],
        difficulty=1,
    )
    db.add(item)
    await db.flush()

    attempt = QuizAttempt(
        quiz_id=quiz.id,
        user_id=user.id,
        attempt_number=1,
        score=0,
        total=1,
        answers=[{"quiz_item_id": str(item.id), "user_answer": "B"}],
    )
    db.add(attempt)
    await db.flush()

    note = WrongAnswerNote(
        attempt_id=attempt.id,
        user_id=user.id,
        quiz_item_id=item.id,
        user_answer="B",
        correct_answer="A",
        wrong_reason="Wrong choice",
        concept_tags=["test"],
        next_review_at=datetime.now(UTC) - timedelta(hours=1),
        is_mastered=False,
    )
    db.add(note)
    await db.commit()
    return user


class TestSendReviewReminders:
    async def test_sends_reminder_for_due_notes(self, db_session: AsyncSession) -> None:
        await _seed_user_with_due_notes(db_session)

        with patch("app.tasks.review_reminder.send_email", new_callable=AsyncMock) as mock_send:
            sent = await send_review_reminders(db_session)

        assert sent == 1
        mock_send.assert_called_once()
        msg = mock_send.call_args[0][0]
        assert msg.to_email == "reminder@example.com"
        assert "복습" in msg.subject

    async def test_no_due_notes_sends_nothing(self, db_session: AsyncSession) -> None:
        with patch("app.tasks.review_reminder.send_email", new_callable=AsyncMock) as mock_send:
            sent = await send_review_reminders(db_session)

        assert sent == 0
        mock_send.assert_not_called()

    async def test_mastered_notes_excluded(self, db_session: AsyncSession) -> None:
        user = await _seed_user_with_due_notes(db_session)

        # Mark all notes as mastered
        from sqlalchemy import update

        await db_session.execute(
            update(WrongAnswerNote)
            .where(WrongAnswerNote.user_id == user.id)
            .values(is_mastered=True)
        )
        await db_session.commit()

        with patch("app.tasks.review_reminder.send_email", new_callable=AsyncMock) as mock_send:
            sent = await send_review_reminders(db_session)

        assert sent == 0
        mock_send.assert_not_called()
