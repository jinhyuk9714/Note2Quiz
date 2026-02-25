from __future__ import annotations

import uuid
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: str | None = None


class UUIDResponse(BaseModel):
    id: uuid.UUID


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
