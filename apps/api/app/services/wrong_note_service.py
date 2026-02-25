from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import QuizItem

SRS_INTERVALS: dict[int, int] = {0: 1, 1: 1, 2: 3, 3: 7, 4: 14, 5: 30}


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

    # Grade
    graded: list[dict[str, object]] = []
    score = 0
    for answer in answers:
        item_id = uuid.UUID(answer["quiz_item_id"])
        item = items_map.get(item_id)
        if not item:
            continue
        is_correct = answer["user_answer"].strip().lower() == item.correct_answer.strip().lower()
        if is_correct:
            score += 1
        graded.append(
            {
                "quiz_item_id": str(item_id),
                "user_answer": answer["user_answer"],
                "is_correct": is_correct,
            }
        )

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
        note = WrongAnswerNote(
            attempt_id=attempt.id,
            user_id=user_id,
            quiz_item_id=item.id,
            user_answer=str(g["user_answer"]),
            correct_answer=item.correct_answer,
            wrong_reason=(
                f"'{g['user_answer']}'(이)라고 답했지만, "
                f"정답은 '{item.correct_answer}'입니다. {item.explanation}"
            ),
            concept_tags=item.concept_tags,
            next_review_at=calculate_next_review(0),
        )
        db.add(note)
        wrong_notes.append(note)

    return attempt, wrong_notes
