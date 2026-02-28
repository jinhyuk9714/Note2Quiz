"""Export service benchmark: full ORM load vs load_only optimization."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only, selectinload

from app.models.attempt import WrongAnswerNote
from app.models.quiz import QuizItem
from tests.benchmarks.conftest import QueryCounter, async_benchmark, compare_results
from tests.benchmarks.seed_factory import SeedResult


async def _fetch_full_load(db: AsyncSession, user_id: uuid.UUID) -> int:
    """BEFORE: full ORM load of quiz_item."""
    stmt = (
        select(WrongAnswerNote)
        .where(WrongAnswerNote.user_id == user_id, WrongAnswerNote.is_mastered == False)  # noqa: E712
        .options(selectinload(WrongAnswerNote.quiz_item))
        .order_by(WrongAnswerNote.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    notes = list(result.scalars().all())
    # Simulate CSV generation: access only question field
    total_len = sum(len(n.quiz_item.question) if n.quiz_item else 0 for n in notes)
    return total_len


async def _fetch_load_only(db: AsyncSession, user_id: uuid.UUID) -> int:
    """AFTER: load_only(QuizItem.question) — selective column loading."""
    stmt = (
        select(WrongAnswerNote)
        .where(WrongAnswerNote.user_id == user_id, WrongAnswerNote.is_mastered == False)  # noqa: E712
        .options(
            selectinload(WrongAnswerNote.quiz_item).load_only(QuizItem.question)
        )
        .order_by(WrongAnswerNote.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    notes = list(result.scalars().all())
    # Same access pattern
    total_len = sum(len(n.quiz_item.question) if n.quiz_item else 0 for n in notes)
    return total_len


@pytest.mark.benchmark
class TestExportBenchmark:
    """Compare full ORM load vs load_only for export data fetching."""

    async def test_before_and_after(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        user_id = large_dataset.user_id

        before = await async_benchmark(
            "full load (before)",
            _fetch_full_load,
            db_session,
            user_id,
            rounds=5,
        )

        after = await async_benchmark(
            "load_only (after)",
            _fetch_load_only,
            db_session,
            user_id,
            rounds=5,
        )

        print(compare_results(before, after))
        print(before.summary())
        print(after.summary())

    async def test_correctness(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Both approaches should return identical results."""
        user_id = large_dataset.user_id

        result_full = await _fetch_full_load(db_session, user_id)
        result_optimized = await _fetch_load_only(db_session, user_id)

        assert result_full == result_optimized

    async def test_query_count_same(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Verify both approaches use the same number of SQL queries."""
        user_id = large_dataset.user_id

        counter1 = QueryCounter()
        with counter1:
            await _fetch_full_load(db_session, user_id)

        counter2 = QueryCounter()
        with counter2:
            await _fetch_load_only(db_session, user_id)

        print(f"\n  Full load queries: {counter1.count}")
        print(f"  load_only queries: {counter2.count}")

        assert counter1.count == counter2.count
