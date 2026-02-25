from __future__ import annotations

from app.schemas.attempt import (
    AnswerItem,
    AnswerResult,
    QuizSubmitRequest,
    QuizSubmitResponse,
    WrongAnswerNoteListResponse,
    WrongAnswerNoteResponse,
)
from app.schemas.auth import (
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
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
)
from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizItemPublicResponse,
    QuizResponse,
)

__all__ = [
    "AnswerItem",
    "AnswerResult",
    "ChunkResponse",
    "DashboardStatsResponse",
    "DocumentDetailResponse",
    "DocumentResponse",
    "ErrorResponse",
    "LearningProgressStats",
    "LoginRequest",
    "QuizGenerateRequest",
    "QuizItemPublicResponse",
    "QuizResponse",
    "QuizSubmitRequest",
    "QuizSubmitResponse",
    "ReviewScheduleDay",
    "ReviewScheduleStats",
    "SignupRequest",
    "TokenResponse",
    "UUIDResponse",
    "UserResponse",
    "WeakConceptItem",
    "WrongAnswerNoteListResponse",
    "WrongAnswerNoteResponse",
]
