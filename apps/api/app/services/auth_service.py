from __future__ import annotations

import logging
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    logger.debug("Creating access token for user=%s", user_id)
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload: dict[str, str | float] = {
        "sub": user_id,
        "exp": expire.timestamp(),
    }
    return jwt.encode(  # pyright: ignore[reportUnknownMemberType]
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> str:
    payload: dict[str, object] = jwt.decode(  # pyright: ignore[reportUnknownMemberType]
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    sub = payload.get("sub")
    if not isinstance(sub, str):
        raise jwt.InvalidTokenError("Missing sub claim")
    return sub


def create_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def create_password_reset_token() -> str:
    return secrets.token_urlsafe(32)
