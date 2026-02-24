from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.quiz import Quiz
from app.schemas.dashboard import (
    DashboardStatsResponse,
    LearningProgressStats,
    ReviewScheduleDay,
    ReviewScheduleStats,
    WeakConceptItem,
)


async def get_dashboard_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> DashboardStatsResponse:
    learning_progress = await _get_learning_progress(db, user_id)
    weak_concepts = await _get_weak_concepts(db, user_id)
    review_schedule = await _get_review_schedule(db, user_id)

    return DashboardStatsResponse(
        learning_progress=learning_progress,
        weak_concepts=weak_concepts,
        review_schedule=review_schedule,
    )


async def _get_learning_progress(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> LearningProgressStats:
    stmt = select(
        func.count(QuizAttempt.id).label("total_quizzes"),
        func.coalesce(func.sum(QuizAttempt.total), 0).label("total_questions"),
        func.coalesce(func.sum(QuizAttempt.score), 0).label("total_correct"),
    ).where(QuizAttempt.user_id == user_id)

    result = await db.execute(stmt)
    row = result.one()
    total_quizzes: int = row.total_quizzes  # type: ignore[assignment]
    total_questions: int = row.total_questions  # type: ignore[assignment]
    total_correct: int = row.total_correct  # type: ignore[assignment]

    doc_stmt = (
        select(func.count(distinct(Quiz.document_id)))
        .select_from(QuizAttempt)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .where(QuizAttempt.user_id == user_id)
    )
    doc_result = await db.execute(doc_stmt)
    documents_studied: int = doc_result.scalar_one()  # type: ignore[assignment]

    accuracy_rate = total_correct / total_questions if total_questions > 0 else 0.0

    return LearningProgressStats(
        total_quizzes_taken=total_quizzes,
        total_questions_answered=total_questions,
        total_correct=total_correct,
        accuracy_rate=round(accuracy_rate, 4),
        documents_studied=documents_studied,
    )


async def _get_weak_concepts(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> list[WeakConceptItem]:
    stmt = select(
        WrongAnswerNote.concept_tags,
        WrongAnswerNote.is_mastered,
    ).where(WrongAnswerNote.user_id == user_id)

    result = await db.execute(stmt)
    rows = result.all()

    tag_stats: dict[str, dict[str, int]] = {}
    for concept_tags, is_mastered in rows:
        tags = cast(list[str], concept_tags) if isinstance(concept_tags, list) else []
        for tag in tags:
            if tag not in tag_stats:
                tag_stats[tag] = {"wrong": 0, "mastered": 0}
            tag_stats[tag]["wrong"] += 1
            if is_mastered:
                tag_stats[tag]["mastered"] += 1

    sorted_tags = sorted(tag_stats.items(), key=lambda x: x[1]["wrong"], reverse=True)[:limit]

    return [
        WeakConceptItem(
            tag=tag,
            wrong_count=stats["wrong"],
            mastered_count=stats["mastered"],
            total_count=stats["wrong"],
        )
        for tag, stats in sorted_tags
    ]


async def _get_review_schedule(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> ReviewScheduleStats:
    now = datetime.now(UTC)
    today = now.date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=UTC)
    tomorrow_start = today_start + timedelta(days=1)

    # Overdue: next_review_at < now AND NOT is_mastered
    overdue_stmt = select(func.count(WrongAnswerNote.id)).where(
        WrongAnswerNote.user_id == user_id,
        WrongAnswerNote.is_mastered == False,  # noqa: E712
        WrongAnswerNote.next_review_at < now,
    )
    overdue_result = await db.execute(overdue_stmt)
    overdue_count: int = overdue_result.scalar_one()  # type: ignore[assignment]

    # Today
    today_stmt = select(func.count(WrongAnswerNote.id)).where(
        WrongAnswerNote.user_id == user_id,
        WrongAnswerNote.is_mastered == False,  # noqa: E712
        WrongAnswerNote.next_review_at >= today_start,
        WrongAnswerNote.next_review_at < tomorrow_start,
    )
    today_result = await db.execute(today_stmt)
    today_count: int = today_result.scalar_one()  # type: ignore[assignment]

    # Upcoming 7 days
    upcoming: list[ReviewScheduleDay] = []
    for i in range(1, 8):
        day_start = today_start + timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        day_stmt = select(func.count(WrongAnswerNote.id)).where(
            WrongAnswerNote.user_id == user_id,
            WrongAnswerNote.is_mastered == False,  # noqa: E712
            WrongAnswerNote.next_review_at >= day_start,
            WrongAnswerNote.next_review_at < day_end,
        )
        day_result = await db.execute(day_stmt)
        count: int = day_result.scalar_one()  # type: ignore[assignment]
        if count > 0:
            upcoming.append(
                ReviewScheduleDay(
                    date=(today + timedelta(days=i)).isoformat(),
                    count=count,
                )
            )

    return ReviewScheduleStats(
        overdue_count=overdue_count,
        today_count=today_count,
        upcoming=upcoming,
    )
