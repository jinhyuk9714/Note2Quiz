"""Wrong note upsert benchmark: individual db.add() vs batch db.add_all()."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import WrongAnswerNote
from app.models.quiz import QuizItem
from tests.benchmarks.conftest import async_benchmark, compare_results
from tests.benchmarks.seed_factory import SeedResult


async def _upsert_individual(
    db: AsyncSession,
    items: list[QuizItem],
    attempt_id: uuid.UUID,
    user_id: uuid.UUID,
) -> int:
    """BEFORE: individual db.add() per note."""
    notes: list[WrongAnswerNote] = []
    for item in items:
        note = WrongAnswerNote(
            attempt_id=attempt_id,
            user_id=user_id,
            quiz_item_id=item.id,
            user_answer="벤치마크오답",
            correct_answer=item.correct_answer,
            wrong_reason=f"'{item.correct_answer}'가 정답",
            concept_tags=item.concept_tags,
            next_review_at=datetime.now(UTC) + timedelta(days=1),
        )
        db.add(note)
        notes.append(note)
    await db.flush()
    # Rollback to prevent actual persistence
    for n in notes:
        await db.delete(n)
    await db.flush()
    return len(notes)


async def _upsert_batch(
    db: AsyncSession,
    items: list[QuizItem],
    attempt_id: uuid.UUID,
    user_id: uuid.UUID,
) -> int:
    """AFTER: batch db.add_all()."""
    notes: list[WrongAnswerNote] = []
    for item in items:
        note = WrongAnswerNote(
            attempt_id=attempt_id,
            user_id=user_id,
            quiz_item_id=item.id,
            user_answer="벤치마크오답",
            correct_answer=item.correct_answer,
            wrong_reason=f"'{item.correct_answer}'가 정답",
            concept_tags=item.concept_tags,
            next_review_at=datetime.now(UTC) + timedelta(days=1),
        )
        notes.append(note)
    if notes:
        db.add_all(notes)
    await db.flush()
    # Rollback
    for n in notes:
        await db.delete(n)
    await db.flush()
    return len(notes)


@pytest.mark.benchmark
class TestWrongNoteBenchmark:
    """Compare individual add vs batch add_all for wrong note creation."""

    async def test_before_and_after(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        user_id = large_dataset.user_id

        # Find quiz_item_ids that ALREADY have wrong notes (to exclude them)
        existing_stmt = select(WrongAnswerNote.quiz_item_id).where(
            WrongAnswerNote.user_id == user_id
        )
        existing_result = await db_session.execute(existing_stmt)
        existing_item_ids = {row[0] for row in existing_result.all()}

        # Load QuizItems that DON'T have wrong notes yet
        all_item_ids = large_dataset.item_ids
        candidate_ids = [iid for iid in all_item_ids if iid not in existing_item_ids][:60]

        stmt = select(QuizItem).where(QuizItem.id.in_(candidate_ids))
        result = await db_session.execute(stmt)
        fresh_items = list(result.scalars().all())[:30]

        if len(fresh_items) < 10:
            pytest.skip("Not enough fresh items for benchmark")

        # Use first attempt from seed
        attempt_id = large_dataset.attempt_ids[0]

        before = await async_benchmark(
            "individual add (before)",
            _upsert_individual,
            db_session,
            fresh_items,
            attempt_id,
            user_id,
            rounds=3,
        )

        after = await async_benchmark(
            "batch add_all (after)",
            _upsert_batch,
            db_session,
            fresh_items,
            attempt_id,
            user_id,
            rounds=3,
        )

        print(compare_results(before, after))
        print(before.summary())
        print(after.summary())
