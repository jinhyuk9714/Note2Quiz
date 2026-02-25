from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import QuizItem, QuizType
from app.services.semantic_grading import grade_answers_semantically

_SEMANTIC_TYPES = {QuizType.SHORT_ANSWER, QuizType.FILL_BLANK}

# SM-2 constants
SM2_INITIAL_EASE: float = 2.5
SM2_MIN_EASE: float = 1.3
SM2_MASTERY_REPETITIONS: int = 5
SM2_MASTERY_EASE_THRESHOLD: float = 2.0


def compute_sm2(
    ease_factor: float,
    consecutive_correct: int,
    interval_days: int,
    quality: int,
) -> tuple[float, int, int]:
    """Apply SM-2 algorithm.

    Returns (new_ease_factor, new_consecutive_correct, new_interval_days).
    """
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(SM2_MIN_EASE, new_ef)

    if quality >= 3:
        new_reps = consecutive_correct + 1
        if new_reps == 1:
            new_interval = 1
        elif new_reps == 2:
            new_interval = 6
        else:
            new_interval = round(interval_days * new_ef)
    else:
        new_reps = 0
        new_interval = 1

    return new_ef, new_reps, new_interval


def apply_sm2_review(note: WrongAnswerNote, quality: int) -> None:
    """Mutate note in-place with SM-2 state after a review."""
    new_ef, new_reps, new_interval = compute_sm2(
        ease_factor=note.ease_factor,
        consecutive_correct=note.consecutive_correct,
        interval_days=note.interval_days,
        quality=quality,
    )
    note.ease_factor = new_ef
    note.consecutive_correct = new_reps
    note.interval_days = new_interval
    note.next_review_at = datetime.now(UTC) + timedelta(days=new_interval)
    note.review_count += 1
    note.is_mastered = new_reps >= SM2_MASTERY_REPETITIONS and new_ef >= SM2_MASTERY_EASE_THRESHOLD


def _initial_review_datetime() -> datetime:
    """Next review for a brand-new or reset wrong note: 1 day."""
    return datetime.now(UTC) + timedelta(days=1)


async def create_attempt_with_wrong_notes(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
    answers: list[dict[str, str]],
) -> tuple[QuizAttempt, list[WrongAnswerNote], int]:
    # Load quiz items
    item_ids = [uuid.UUID(a["quiz_item_id"]) for a in answers]
    stmt = select(QuizItem).where(QuizItem.id.in_(item_ids))
    result = await db.execute(stmt)
    items_map = {item.id: item for item in result.scalars().all()}

    # Phase 1: Exact match grading
    graded: list[dict[str, object]] = []
    needs_semantic: list[dict[str, str]] = []

    for answer in answers:
        item_id = uuid.UUID(answer["quiz_item_id"])
        item = items_map.get(item_id)
        if not item:
            continue

        exact_match = answer["user_answer"].strip().lower() == item.correct_answer.strip().lower()

        if exact_match:
            graded.append(
                {
                    "quiz_item_id": str(item_id),
                    "user_answer": answer["user_answer"],
                    "is_correct": True,
                    "grading_method": "exact",
                }
            )
        elif item.quiz_type in _SEMANTIC_TYPES:
            needs_semantic.append(
                {
                    "id": str(item_id),
                    "question": item.question,
                    "correct_answer": item.correct_answer,
                    "user_answer": answer["user_answer"],
                }
            )
            graded.append(
                {
                    "quiz_item_id": str(item_id),
                    "user_answer": answer["user_answer"],
                    "is_correct": False,
                    "grading_method": "pending_semantic",
                }
            )
        else:
            graded.append(
                {
                    "quiz_item_id": str(item_id),
                    "user_answer": answer["user_answer"],
                    "is_correct": False,
                    "grading_method": "exact",
                }
            )

    # Phase 2: Semantic grading (single batched API call)
    if needs_semantic:
        semantic_results = await grade_answers_semantically(needs_semantic)

        for g in graded:
            if g["grading_method"] == "pending_semantic":
                item_id_str = str(g["quiz_item_id"])
                if item_id_str in semantic_results:
                    g["is_correct"] = semantic_results[item_id_str]
                    g["grading_method"] = "semantic"
                else:
                    g["grading_method"] = "exact_fallback"

    score = sum(1 for g in graded if g["is_correct"])

    # Compute attempt_number
    count_stmt = select(func.count(QuizAttempt.id)).where(
        QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id
    )
    existing_count = (await db.execute(count_stmt)).scalar_one()
    attempt_number = int(existing_count) + 1

    # Create attempt
    attempt = QuizAttempt(
        quiz_id=quiz_id,
        user_id=user_id,
        attempt_number=attempt_number,
        score=score,
        total=len(graded),
        answers=graded,  # type: ignore[arg-type]
    )
    db.add(attempt)
    await db.flush()

    # Upsert wrong answer notes (deduplicate by user_id + quiz_item_id)
    wrong_item_ids = [uuid.UUID(str(g["quiz_item_id"])) for g in graded if not g["is_correct"]]

    # Load existing notes for these items
    existing_map: dict[uuid.UUID, WrongAnswerNote] = {}
    if wrong_item_ids:
        existing_stmt = select(WrongAnswerNote).where(
            WrongAnswerNote.user_id == user_id,
            WrongAnswerNote.quiz_item_id.in_(wrong_item_ids),
        )
        existing_result = await db.execute(existing_stmt)
        for note in existing_result.scalars().all():
            existing_map[note.quiz_item_id] = note

    new_notes: list[WrongAnswerNote] = []
    updated_count = 0

    for g in graded:
        if g["is_correct"]:
            continue
        item = items_map[uuid.UUID(str(g["quiz_item_id"]))]
        grading_method = str(g.get("grading_method", "exact"))
        if grading_method == "semantic":
            wrong_reason = (
                f"'{g['user_answer']}'(이)라고 답했지만, "
                f"정답은 '{item.correct_answer}'입니다. "
                f"(AI가 의미적으로 비교한 결과 오답으로 판정) "
                f"{item.explanation}"
            )
        else:
            wrong_reason = (
                f"'{g['user_answer']}'(이)라고 답했지만, "
                f"정답은 '{item.correct_answer}'입니다. {item.explanation}"
            )

        existing = existing_map.get(item.id)
        if existing:
            # Update existing note: reset SRS progress
            existing.attempt_id = attempt.id
            existing.user_answer = str(g["user_answer"])
            existing.correct_answer = item.correct_answer
            existing.wrong_reason = wrong_reason
            existing.concept_tags = item.concept_tags
            existing.consecutive_correct = 0
            existing.interval_days = 1
            existing.ease_factor = SM2_INITIAL_EASE
            existing.next_review_at = _initial_review_datetime()
            existing.is_mastered = False
            updated_count += 1
        else:
            note = WrongAnswerNote(
                attempt_id=attempt.id,
                user_id=user_id,
                quiz_item_id=item.id,
                user_answer=str(g["user_answer"]),
                correct_answer=item.correct_answer,
                wrong_reason=wrong_reason,
                concept_tags=item.concept_tags,
                next_review_at=_initial_review_datetime(),
            )
            db.add(note)
            new_notes.append(note)

    return attempt, new_notes, updated_count
