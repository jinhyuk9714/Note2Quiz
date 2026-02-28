from __future__ import annotations

import statistics
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, TypeVar

import pytest
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession

from tests.benchmarks.seed_factory import SeedResult, seed_benchmark_data
from tests.conftest import TestSessionFactory, test_engine

T = TypeVar("T")


# ---------------------------------------------------------------------------
# QueryCounter — counts SQL queries via SQLAlchemy events
# ---------------------------------------------------------------------------


class QueryCounter:
    """Context manager that counts SQL queries on the test engine."""

    def __init__(self) -> None:
        self._count = 0

    def _callback(
        self,
        _conn: Any,
        _cursor: Any,
        _statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        self._count += 1

    def __enter__(self) -> QueryCounter:
        self._count = 0
        event.listen(test_engine.sync_engine, "before_cursor_execute", self._callback)
        return self

    def __exit__(self, *args: object) -> None:
        event.remove(test_engine.sync_engine, "before_cursor_execute", self._callback)

    @property
    def count(self) -> int:
        return self._count


# ---------------------------------------------------------------------------
# BenchmarkResult — timing and query stats
# ---------------------------------------------------------------------------


@dataclass
class BenchmarkResult:
    name: str
    times_ms: list[float]
    query_count: int
    rounds: int

    @property
    def min_ms(self) -> float:
        return min(self.times_ms)

    @property
    def max_ms(self) -> float:
        return max(self.times_ms)

    @property
    def mean_ms(self) -> float:
        return statistics.mean(self.times_ms)

    @property
    def median_ms(self) -> float:
        return statistics.median(self.times_ms)

    @property
    def stddev_ms(self) -> float:
        return statistics.stdev(self.times_ms) if len(self.times_ms) > 1 else 0.0

    def summary(self) -> str:
        lines = [
            f"  {self.name}",
            f"    Mean:   {self.mean_ms:>8.2f} ms",
            f"    Median: {self.median_ms:>8.2f} ms",
            f"    Min:    {self.min_ms:>8.2f} ms",
            f"    Max:    {self.max_ms:>8.2f} ms",
            f"    StdDev: {self.stddev_ms:>8.2f} ms",
            f"    Queries: {self.query_count}",
            f"    Rounds:  {self.rounds}",
        ]
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# async_benchmark — run an async callable multiple times
# ---------------------------------------------------------------------------


async def async_benchmark(
    name: str,
    func: Callable[..., Awaitable[T]],
    *args: Any,
    rounds: int = 5,
    warmup: int = 1,
    **kwargs: Any,
) -> BenchmarkResult:
    """Run an async callable multiple times and return timing stats."""
    # Warmup runs (not counted)
    for _ in range(warmup):
        await func(*args, **kwargs)

    # Timed runs
    times: list[float] = []
    query_count = 0
    for i in range(rounds):
        counter = QueryCounter()
        with counter:
            start = time.perf_counter()
            await func(*args, **kwargs)
            elapsed = (time.perf_counter() - start) * 1000
        times.append(elapsed)
        if i == 0:
            query_count = counter.count

    return BenchmarkResult(
        name=name,
        times_ms=times,
        query_count=query_count,
        rounds=rounds,
    )


# ---------------------------------------------------------------------------
# compare_results — formatted before/after comparison
# ---------------------------------------------------------------------------


def compare_results(before: BenchmarkResult, after: BenchmarkResult) -> str:
    """Return formatted comparison table."""
    latency_change = (
        ((after.mean_ms - before.mean_ms) / before.mean_ms * 100)
        if before.mean_ms > 0
        else 0.0
    )
    query_change = after.query_count - before.query_count

    border = "=" * 62
    lines = [
        "",
        border,
        f"  {before.name}  vs  {after.name}",
        border,
        f"  {'Metric':<20} {'Before':>10} {'After':>10} {'Change':>10}",
        f"  {'-' * 20} {'-' * 10} {'-' * 10} {'-' * 10}",
        f"  {'Mean latency':<20} {before.mean_ms:>8.1f}ms {after.mean_ms:>8.1f}ms {latency_change:>+8.1f}%",
        f"  {'Median latency':<20} {before.median_ms:>8.1f}ms {after.median_ms:>8.1f}ms",
        f"  {'SQL queries':<20} {before.query_count:>10} {after.query_count:>10} {query_change:>+10}",
        border,
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def large_dataset(db_session: AsyncSession) -> SeedResult:
    """Seed large-scale benchmark data."""
    from app.models.user import User
    from app.services.auth_service import hash_password

    user = User(
        id=__import__("uuid").UUID("00000000-0000-0000-0000-000000000001"),
        email="test@example.com",
        display_name="Test User",
        hashed_password=hash_password("testpassword123"),
    )
    db_session.add(user)
    await db_session.flush()

    result = await seed_benchmark_data(db_session, user.id)
    await db_session.commit()
    return result
