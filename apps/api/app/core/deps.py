from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

DBSession = Annotated[AsyncSession, Depends(get_db)]

# Auth
_bearer_scheme = HTTPBearer()


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer_scheme)],
) -> uuid.UUID:
    """Extract and validate user_id from JWT Bearer token."""
    from app.services.auth_service import decode_access_token

    try:
        user_id_str = decode_access_token(credentials.credentials)
        return uuid.UUID(user_id_str)
    except Exception as exc:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


CurrentUserID = Annotated[uuid.UUID, Depends(get_current_user_id)]
