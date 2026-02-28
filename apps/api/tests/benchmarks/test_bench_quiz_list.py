"""Quiz list benchmark: subquery vs CTE + filter helper deduplication."""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attempt import QuizAttempt
from app.models.document import Document
from app.models.quiz import Quiz
from tests.benchmarks.conftest import async_benchmark, compare_results
from tests.benchmarks.seed_factory import SeedResult


async def _list_quizzes_subquery(db: AsyncSession, user_id: uuid.UUID) -> int:
    """BEFORE: original subquery approach (window function computed twice)."""
    attempt_numbered = (
        select(
            QuizAttempt.quiz_id,
            QuizAttempt.score,
            QuizAttempt.total,
            func.count(QuizAttempt.id)
            .over(partition_by=QuizAttempt.quiz_id)
            .label("attempt_count"),
            func.row_number()
            .over(
                partition_by=QuizAttempt.quiz_id,
                order_by=QuizAttempt.created_at.desc(),
            )
            .label("rn"),
        )
        .where(QuizAttempt.user_id == user_id)
        .subquery()
    )
    attempt_stats_sq = (
        select(
            attempt_numbered.c.quiz_id,
            attempt_numbered.c.attempt_count,
            attempt_numbered.c.score,
            attempt_numbered.c.total,
        )
        .where(attempt_numbered.c.rn == 1)
        .subquery()
    )

    # Count query (uses subquery)
    count_q = (
        select(func.count(Quiz.id))
        .join(Quiz.document)
        .outerjoin(attempt_stats_sq, Quiz.id == attempt_stats_sq.c.quiz_id)
        .where(Document.owner_id == user_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    # Data query (uses same subquery — DB computes window function again)
    data_q = (
        select(
            Quiz,
            func.coalesce(attempt_stats_sq.c.attempt_count, 0).label("attempt_count"),
            attempt_stats_sq.c.score.label("latest_score"),
            attempt_stats_sq.c.total.label("latest_total"),
        )
        .join(Quiz.document)
        .outerjoin(attempt_stats_sq, Quiz.id == attempt_stats_sq.c.quiz_id)
        .where(Document.owner_id == user_id)
        .order_by(Quiz.created_at.desc())
        .offset(0)
        .limit(20)
        .options(selectinload(Quiz.document))
    )
    result = await db.execute(data_q)
    rows = result.all()
    return int(total) + len(rows)


async def _list_quizzes_cte(db: AsyncSession, user_id: uuid.UUID) -> int:
    """AFTER: CTE approach (window function computed once, reused)."""
    attempt_numbered = (
        select(
            QuizAttempt.quiz_id,
            QuizAttempt.score,
            QuizAttempt.total,
            func.count(QuizAttempt.id)
            .over(partition_by=QuizAttempt.quiz_id)
            .label("attempt_count"),
            func.row_number()
            .over(
                partition_by=QuizAttempt.quiz_id,
                order_by=QuizAttempt.created_at.desc(),
            )
            .label("rn"),
        )
        .where(QuizAttempt.user_id == user_id)
        .subquery()
    )
    attempt_stats_cte = (
        select(
            attempt_numbered.c.quiz_id,
            attempt_numbered.c.attempt_count,
            attempt_numbered.c.score,
            attempt_numbered.c.total,
        )
        .where(attempt_numbered.c.rn == 1)
        .cte("attempt_stats")
    )

    # Count query (reuses CTE)
    count_q = (
        select(func.count(Quiz.id))
        .join(Quiz.document)
        .outerjoin(attempt_stats_cte, Quiz.id == attempt_stats_cte.c.quiz_id)
        .where(Document.owner_id == user_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    # Data query (reuses same CTE — no re-computation)
    data_q = (
        select(
            Quiz,
            func.coalesce(attempt_stats_cte.c.attempt_count, 0).label("attempt_count"),
            attempt_stats_cte.c.score.label("latest_score"),
            attempt_stats_cte.c.total.label("latest_total"),
        )
        .join(Quiz.document)
        .outerjoin(attempt_stats_cte, Quiz.id == attempt_stats_cte.c.quiz_id)
        .where(Document.owner_id == user_id)
        .order_by(Quiz.created_at.desc())
        .offset(0)
        .limit(20)
        .options(selectinload(Quiz.document))
    )
    result = await db.execute(data_q)
    rows = result.all()
    return int(total) + len(rows)


@pytest.mark.benchmark
class TestQuizListBenchmark:
    """Compare subquery vs CTE for quiz list with attempt stats."""

    async def test_before_and_after(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        user_id = large_dataset.user_id

        before = await async_benchmark(
            "subquery (before)",
            _list_quizzes_subquery,
            db_session,
            user_id,
            rounds=5,
        )

        after = await async_benchmark(
            "CTE (after)",
            _list_quizzes_cte,
            db_session,
            user_id,
            rounds=5,
        )

        print(compare_results(before, after))
        print(before.summary())
        print(after.summary())

    async def test_filter_deduplication(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Verify the CTE approach returns same results as subquery."""
        user_id = large_dataset.user_id

        result_sub = await _list_quizzes_subquery(db_session, user_id)
        result_cte = await _list_quizzes_cte(db_session, user_id)

        assert result_sub == result_cte, (
            f"Subquery total+rows={result_sub} != CTE total+rows={result_cte}"
        )
