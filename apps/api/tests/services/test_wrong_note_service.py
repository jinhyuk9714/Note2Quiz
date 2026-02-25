from __future__ import annotations

from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock

from app.services.wrong_note_service import (
    SM2_INITIAL_EASE,
    SM2_MASTERY_EASE_THRESHOLD,
    SM2_MASTERY_REPETITIONS,
    SM2_MIN_EASE,
    apply_sm2_review,
    compute_sm2,
)


class TestComputeSm2:
    def test_easy_increases_ef(self) -> None:
        ef, reps, interval = compute_sm2(2.5, 2, 6, quality=5)
        assert ef > 2.5
        assert reps == 3
        assert interval == round(6 * ef)

    def test_hard_decreases_ef_but_stays_correct(self) -> None:
        ef, reps, interval = compute_sm2(2.5, 2, 6, quality=3)
        assert ef < 2.5
        assert reps == 3
        assert interval > 0

    def test_again_resets_reps_and_interval(self) -> None:
        _, reps, interval = compute_sm2(2.5, 4, 14, quality=1)
        assert reps == 0
        assert interval == 1

    def test_ef_floor_at_min_ease(self) -> None:
        ef = SM2_INITIAL_EASE
        for _ in range(20):
            ef, _, _ = compute_sm2(ef, 1, 1, quality=3)
        assert ef >= SM2_MIN_EASE

    def test_first_repetition_interval_is_1(self) -> None:
        _, reps, interval = compute_sm2(2.5, 0, 1, quality=5)
        assert reps == 1
        assert interval == 1

    def test_second_repetition_interval_is_6(self) -> None:
        _, reps, interval = compute_sm2(2.5, 1, 1, quality=5)
        assert reps == 2
        assert interval == 6

    def test_third_repetition_uses_ef_multiplier(self) -> None:
        ef_new, reps, interval = compute_sm2(2.5, 2, 6, quality=5)
        assert reps == 3
        assert interval == round(6 * ef_new)


class TestApplySm2Review:
    def _make_note(self) -> MagicMock:
        note = MagicMock()
        note.ease_factor = SM2_INITIAL_EASE
        note.consecutive_correct = 0
        note.interval_days = 1
        note.review_count = 0
        note.is_mastered = False
        note.next_review_at = None
        return note

    def test_easy_review_increments_state(self) -> None:
        note = self._make_note()
        apply_sm2_review(note, quality=5)
        assert note.consecutive_correct == 1
        assert note.review_count == 1
        assert note.is_mastered is False
        assert note.next_review_at is not None

    def test_again_resets_state(self) -> None:
        note = self._make_note()
        note.consecutive_correct = 3
        note.interval_days = 7
        apply_sm2_review(note, quality=1)
        assert note.consecutive_correct == 0
        assert note.interval_days == 1
        assert note.is_mastered is False

    def test_mastery_requires_reps_and_ef(self) -> None:
        note = self._make_note()
        for _ in range(SM2_MASTERY_REPETITIONS):
            apply_sm2_review(note, quality=5)
        assert note.is_mastered is True
        assert note.ease_factor >= SM2_MASTERY_EASE_THRESHOLD

    def test_mastery_not_achieved_with_low_ef(self) -> None:
        note = self._make_note()
        note.ease_factor = SM2_MIN_EASE
        note.consecutive_correct = SM2_MASTERY_REPETITIONS - 1
        note.interval_days = 14
        apply_sm2_review(note, quality=5)
        # reps >= 5 but EF below threshold
        assert note.consecutive_correct == SM2_MASTERY_REPETITIONS
        assert note.is_mastered is False

    def test_next_review_is_approximately_interval_days_away(self) -> None:
        note = self._make_note()
        before = datetime.now(UTC)
        apply_sm2_review(note, quality=5)
        expected = before + timedelta(days=note.interval_days)
        delta = abs((note.next_review_at - expected).total_seconds())  # type: ignore[operator]
        assert delta < 5

    def test_hard_review_keeps_correct_streak(self) -> None:
        note = self._make_note()
        apply_sm2_review(note, quality=3)
        assert note.consecutive_correct == 1
        assert note.ease_factor < SM2_INITIAL_EASE
