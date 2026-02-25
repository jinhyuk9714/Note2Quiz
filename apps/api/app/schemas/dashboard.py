from __future__ import annotations

from pydantic import BaseModel


class LearningProgressStats(BaseModel):
    total_quizzes_taken: int
    total_questions_answered: int
    total_correct: int
    accuracy_rate: float
    documents_studied: int


class WeakConceptItem(BaseModel):
    tag: str
    wrong_count: int
    mastered_count: int
    total_count: int


class ReviewScheduleDay(BaseModel):
    date: str
    count: int


class ReviewScheduleStats(BaseModel):
    overdue_count: int
    today_count: int
    upcoming: list[ReviewScheduleDay]


class StreakStats(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    total_active_days: int
    last_activity_date: str | None


class MasterySummaryStats(BaseModel):
    total_wrong_notes: int
    mastered_count: int
    mastery_rate: float


class DashboardStatsResponse(BaseModel):
    learning_progress: LearningProgressStats
    weak_concepts: list[WeakConceptItem]
    review_schedule: ReviewScheduleStats
    streak: StreakStats
    mastery_summary: MasterySummaryStats
