from __future__ import annotations

import uuid

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    detail: str | None = None


class UUIDResponse(BaseModel):
    id: uuid.UUID
