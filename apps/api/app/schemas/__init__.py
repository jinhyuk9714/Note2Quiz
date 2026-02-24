from __future__ import annotations

from app.schemas.attempt import (
    AnswerItem,
    AnswerResult,
    QuizSubmitRequest,
    QuizSubmitResponse,
    WrongAnswerNoteListResponse,
    WrongAnswerNoteResponse,
)
from app.schemas.common import ErrorResponse, UUIDResponse
from app.schemas.dashboard import (
    DashboardStatsResponse,
    LearningProgressStats,
    ReviewScheduleDay,
    ReviewScheduleStats,
    WeakConceptItem,
)
from app.schemas.document import (
    ChunkResponse,
    DocumentDetailResponse,
    DocumentResponse,
    DocumentUploadRequest,
)
from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizItemResponse,
    QuizResponse,
)

__all__ = [
    "AnswerItem",
    "AnswerResult",
    "ChunkResponse",
    "DashboardStatsResponse",
    "DocumentDetailResponse",
    "DocumentResponse",
    "DocumentUploadRequest",
    "ErrorResponse",
    "LearningProgressStats",
    "QuizGenerateRequest",
    "QuizItemResponse",
    "QuizResponse",
    "QuizSubmitRequest",
    "QuizSubmitResponse",
    "ReviewScheduleDay",
    "ReviewScheduleStats",
    "UUIDResponse",
    "WeakConceptItem",
    "WrongAnswerNoteListResponse",
    "WrongAnswerNoteResponse",
]
