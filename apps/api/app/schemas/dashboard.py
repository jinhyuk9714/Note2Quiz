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


class DashboardStatsResponse(BaseModel):
    learning_progress: LearningProgressStats
    weak_concepts: list[WeakConceptItem]
    review_schedule: ReviewScheduleStats
