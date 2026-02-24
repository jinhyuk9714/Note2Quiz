from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.services.wrong_note_service import SRS_INTERVALS, calculate_next_review


class TestCalculateNextReview:
    def test_zero_consecutive_returns_1_day(self) -> None:
        before = datetime.now(UTC)
        result = calculate_next_review(0)
        expected_delta = timedelta(days=SRS_INTERVALS[0])  # 1 day
        assert before + expected_delta - timedelta(seconds=2) <= result
        assert result <= before + expected_delta + timedelta(seconds=2)

    def test_increasing_intervals(self) -> None:
        results = [calculate_next_review(i) for i in range(6)]
        for i in range(len(results) - 1):
            assert results[i] <= results[i + 1]

    def test_beyond_max_defaults_to_30(self) -> None:
        before = datetime.now(UTC)
        result = calculate_next_review(999)
        assert result >= before + timedelta(days=29)

    def test_all_srs_intervals_covered(self) -> None:
        for level, days in SRS_INTERVALS.items():
            result = calculate_next_review(level)
            expected = datetime.now(UTC) + timedelta(days=days)
            assert abs((result - expected).total_seconds()) < 2
