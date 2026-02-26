from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from sqlalchemy import distinct, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.document import Document
from app.models.quiz import Quiz
from app.schemas.dashboard import (
    DailyTrendPoint,
    DashboardStatsResponse,
    DashboardTrendsResponse,
    LearningProgressStats,
    MasterySummaryStats,
    RecentActivityItem,
    ReviewScheduleDay,
    ReviewScheduleStats,
    StreakStats,
    WeakConceptItem,
)


async def get_dashboard_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> DashboardStatsResponse:
    learning_progress = await _get_learning_progress(db, user_id)
    weak_concepts = await _get_weak_concepts(db, user_id)
    review_schedule = await _get_review_schedule(db, user_id)
    streak = await _get_streak_stats(db, user_id)
    mastery_summary = await _get_mastery_summary(db, user_id)
    recent_activity = await _get_recent_activity(db, user_id)

    return DashboardStatsResponse(
        learning_progress=learning_progress,
        weak_concepts=weak_concepts,
        review_schedule=review_schedule,
        streak=streak,
        mastery_summary=mastery_summary,
        recent_activity=recent_activity,
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
    # Detect dialect: use PostgreSQL jsonb_array_elements_text for DB-side
    # aggregation; fall back to Python-side processing for SQLite (tests).
    dialect_name = db.bind.dialect.name if db.bind else "unknown"  # type: ignore[union-attr]

    if dialect_name == "postgresql":
        stmt = text("""
            SELECT
                tag,
                COUNT(*) AS wrong_count,
                COUNT(*) FILTER (WHERE is_mastered = TRUE) AS mastered_count
            FROM wrong_answer_notes,
                 jsonb_array_elements_text(concept_tags) AS tag
            WHERE user_id = :user_id
            GROUP BY tag
            ORDER BY wrong_count DESC
            LIMIT :limit
        """)
        result = await db.execute(stmt, {"user_id": user_id, "limit": limit})
        rows = result.all()
        return [
            WeakConceptItem(
                tag=row[0],
                wrong_count=row[1],
                mastered_count=row[2],
                total_count=row[1],
            )
            for row in rows
        ]

    # Fallback for SQLite / other dialects
    orm_stmt = select(
        WrongAnswerNote.concept_tags,
        WrongAnswerNote.is_mastered,
    ).where(WrongAnswerNote.user_id == user_id)

    result = await db.execute(orm_stmt)
    orm_rows = result.all()

    tag_stats: dict[str, dict[str, int]] = {}
    for concept_tags, is_mastered in orm_rows:
        tags: list[str] = concept_tags if isinstance(concept_tags, list) else []
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


async def _get_streak_stats(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> StreakStats:
    stmt = (
        select(func.date(QuizAttempt.created_at).label("day"))
        .distinct()
        .where(QuizAttempt.user_id == user_id)
        .order_by(func.date(QuizAttempt.created_at).desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    # func.date() returns date objects on PostgreSQL but strings on SQLite
    days: list[date] = []
    for row in rows:
        raw = row.day  # type: ignore[attr-defined]
        if isinstance(raw, str):
            days.append(date.fromisoformat(raw))
        elif isinstance(raw, date):
            days.append(raw)

    if not days:
        return StreakStats(
            current_streak_days=0,
            longest_streak_days=0,
            total_active_days=0,
            last_activity_date=None,
        )

    today = datetime.now(UTC).date()

    # Calculate current streak (from today or yesterday backwards)
    current_streak = 0
    if days[0] == today or days[0] == today - timedelta(days=1):
        current_streak = 1
        for i in range(1, len(days)):
            if days[i] == days[i - 1] - timedelta(days=1):
                current_streak += 1
            else:
                break

    # Calculate longest streak
    longest_streak = 1
    run = 1
    for i in range(1, len(days)):
        if days[i] == days[i - 1] - timedelta(days=1):
            run += 1
            longest_streak = max(longest_streak, run)
        else:
            run = 1

    return StreakStats(
        current_streak_days=current_streak,
        longest_streak_days=longest_streak,
        total_active_days=len(days),
        last_activity_date=days[0].isoformat(),
    )


async def _get_mastery_summary(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> MasterySummaryStats:
    total_stmt = select(func.count(WrongAnswerNote.id)).where(
        WrongAnswerNote.user_id == user_id,
    )
    total_result = await db.execute(total_stmt)
    total: int = total_result.scalar_one()  # type: ignore[assignment]

    mastered_stmt = select(func.count(WrongAnswerNote.id)).where(
        WrongAnswerNote.user_id == user_id,
        WrongAnswerNote.is_mastered == True,  # noqa: E712
    )
    mastered_result = await db.execute(mastered_stmt)
    mastered: int = mastered_result.scalar_one()  # type: ignore[assignment]

    mastery_rate = mastered / total if total > 0 else 0.0

    return MasterySummaryStats(
        total_wrong_notes=total,
        mastered_count=mastered,
        mastery_rate=round(mastery_rate, 4),
    )


async def _get_recent_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    limit: int = 10,
) -> list[RecentActivityItem]:
    # Recent documents
    doc_stmt = (
        select(Document.id, Document.title, Document.chunk_count, Document.created_at)
        .where(Document.owner_id == user_id)
        .order_by(Document.created_at.desc())
        .limit(limit)
    )
    doc_result = await db.execute(doc_stmt)
    doc_rows = doc_result.all()

    # Recent quiz attempts (join with Quiz for title)
    attempt_stmt = (
        select(
            Quiz.id.label("quiz_id"),
            Quiz.title,
            QuizAttempt.score,
            QuizAttempt.total,
            QuizAttempt.created_at,
        )
        .select_from(QuizAttempt)
        .join(Quiz, QuizAttempt.quiz_id == Quiz.id)
        .where(QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc())
        .limit(limit)
    )
    attempt_result = await db.execute(attempt_stmt)
    attempt_rows = attempt_result.all()

    items: list[RecentActivityItem] = []

    for row in doc_rows:
        items.append(
            RecentActivityItem(
                type="document_uploaded",
                title=row.title,  # type: ignore[union-attr]
                description=f"{row.chunk_count}개 섹션",  # type: ignore[union-attr]
                entity_id=str(row.id),
                created_at=row.created_at.isoformat(),  # type: ignore[union-attr]
            )
        )

    for row in attempt_rows:
        items.append(
            RecentActivityItem(
                type="quiz_attempted",
                title=row.title,  # type: ignore[union-attr]
                description=f"{row.score}/{row.total} 정답",  # type: ignore[union-attr]
                entity_id=str(row.quiz_id),  # type: ignore[union-attr]
                created_at=row.created_at.isoformat(),  # type: ignore[union-attr]
            )
        )

    items.sort(key=lambda x: x.created_at, reverse=True)
    return items[:limit]


# ──────────────────────────────────────────────────────────
# Dashboard Trends
# ──────────────────────────────────────────────────────────


async def get_dashboard_trends(
    db: AsyncSession,
    user_id: uuid.UUID,
    days: int = 30,
) -> DashboardTrendsResponse:
    daily_quiz_trend = await _get_daily_quiz_trend(db, user_id, days)
    return DashboardTrendsResponse(
        daily_quiz_trend=daily_quiz_trend,
        days=days,
    )


async def _get_daily_quiz_trend(
    db: AsyncSession,
    user_id: uuid.UUID,
    days: int,
) -> list[DailyTrendPoint]:
    since = datetime.now(UTC) - timedelta(days=days)

    stmt = (
        select(
            func.date(QuizAttempt.created_at).label("day"),
            func.count(QuizAttempt.id).label("quiz_count"),
            func.coalesce(func.sum(QuizAttempt.total), 0).label("questions_answered"),
            func.coalesce(func.sum(QuizAttempt.score), 0).label("total_correct"),
        )
        .where(
            QuizAttempt.user_id == user_id,
            QuizAttempt.created_at >= since,
        )
        .group_by(func.date(QuizAttempt.created_at))
        .order_by(func.date(QuizAttempt.created_at).asc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    points: list[DailyTrendPoint] = []
    for row in rows:
        raw_day = row.day  # type: ignore[attr-defined]
        day_str: str = raw_day if isinstance(raw_day, str) else raw_day.isoformat()

        quiz_count: int = row.quiz_count  # type: ignore[assignment]
        questions_answered: int = row.questions_answered  # type: ignore[assignment]
        total_correct: int = row.total_correct  # type: ignore[assignment]

        accuracy = total_correct / questions_answered if questions_answered > 0 else 0.0

        points.append(
            DailyTrendPoint(
                date=day_str,
                quiz_count=quiz_count,
                questions_answered=questions_answered,
                accuracy_rate=round(accuracy, 4),
            )
        )

    return points
