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
    "DocumentDetailResponse",
    "DocumentResponse",
    "DocumentUploadRequest",
    "ErrorResponse",
    "QuizGenerateRequest",
    "QuizItemResponse",
    "QuizResponse",
    "QuizSubmitRequest",
    "QuizSubmitResponse",
    "UUIDResponse",
    "WrongAnswerNoteListResponse",
    "WrongAnswerNoteResponse",
]
