from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import QuizItem, QuizType
from app.services.semantic_grading import grade_answers_semantically

SRS_INTERVALS: dict[int, int] = {0: 1, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30}

_SEMANTIC_TYPES = {QuizType.SHORT_ANSWER, QuizType.FILL_BLANK}


def calculate_next_review(consecutive_correct: int) -> datetime:
    days = SRS_INTERVALS.get(consecutive_correct, 30)
    return datetime.now(UTC) + timedelta(days=days)


async def create_attempt_with_wrong_notes(
    db: AsyncSession,
    quiz_id: uuid.UUID,
    user_id: uuid.UUID,
    answers: list[dict[str, str]],
) -> tuple[QuizAttempt, list[WrongAnswerNote]]:
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

    # Create wrong answer notes
    wrong_notes: list[WrongAnswerNote] = []
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
        note = WrongAnswerNote(
            attempt_id=attempt.id,
            user_id=user_id,
            quiz_item_id=item.id,
            user_answer=str(g["user_answer"]),
            correct_answer=item.correct_answer,
            wrong_reason=wrong_reason,
            concept_tags=item.concept_tags,
            next_review_at=calculate_next_review(0),
        )
        db.add(note)
        wrong_notes.append(note)

    return attempt, wrong_notes
