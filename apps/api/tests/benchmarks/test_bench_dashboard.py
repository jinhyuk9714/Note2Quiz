"""Dashboard stats performance benchmark: sequential vs parallel queries."""

from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.dashboard_service import get_dashboard_stats
from tests.benchmarks.conftest import async_benchmark, compare_results
from tests.benchmarks.seed_factory import SeedResult
from tests.conftest import TestSessionFactory


@pytest.mark.benchmark
class TestDashboardBenchmark:
    """Measure dashboard stats endpoint latency before/after parallelization."""

    async def test_before_and_after(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        user_id = large_dataset.user_id

        # BEFORE: sequential (default, no session_factory)
        before = await async_benchmark(
            "sequential",
            get_dashboard_stats,
            db_session,
            user_id,
            rounds=5,
        )

        # AFTER: parallel (with session_factory for asyncio.gather)
        after = await async_benchmark(
            "parallel",
            get_dashboard_stats,
            db_session,
            user_id,
            session_factory=TestSessionFactory,
            rounds=5,
        )

        # Print comparison
        print(compare_results(before, after))
        print(before.summary())
        print(after.summary())

        # Correctness: both should return valid stats
        result = await get_dashboard_stats(db_session, user_id, session_factory=TestSessionFactory)
        assert result.learning_progress.total_quizzes_taken > 0
        assert result.streak.total_active_days > 0
        assert result.mastery_summary.total_wrong_notes > 0


@pytest.mark.benchmark
async def test_dashboard_query_count(db_session: AsyncSession, large_dataset: SeedResult) -> None:
    """Verify query count doesn't change between sequential and parallel."""
    from tests.benchmarks.conftest import QueryCounter

    user_id = large_dataset.user_id

    # Count queries for sequential
    counter = QueryCounter()
    with counter:
        await get_dashboard_stats(db_session, user_id)
    sequential_queries = counter.count

    # Count queries for parallel
    counter2 = QueryCounter()
    with counter2:
        await get_dashboard_stats(db_session, user_id, session_factory=TestSessionFactory)
    parallel_queries = counter2.count

    print(f"\n  Sequential queries: {sequential_queries}")
    print(f"  Parallel queries:   {parallel_queries}")

    # Same query count = correctness preserved
    assert sequential_queries == parallel_queries
