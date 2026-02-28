from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.core.rate_limit import limiter
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    DeleteAccountRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.services.auth_service import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user: User) -> TokenResponse:
    """Generate access + refresh tokens and persist refresh token on user."""
    access = create_access_token(str(user.id))
    refresh = create_refresh_token()
    user.refresh_token = refresh
    user.refresh_token_expires_at = datetime.now(UTC) + timedelta(
        days=settings.jwt_refresh_expire_days
    )
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/signup", response_model=TokenResponse, status_code=201)
@limiter.limit(settings.rate_limit_auth)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def signup(request: Request, payload: SignupRequest, db: DBSession) -> TokenResponse:
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()

    tokens = _issue_tokens(user)
    await db.commit()
    return tokens


@router.post("/login", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_auth)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def login(request: Request, payload: LoginRequest, db: DBSession) -> TokenResponse:
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    tokens = _issue_tokens(user)
    await db.commit()
    return tokens


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit(settings.rate_limit_auth)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def refresh(request: Request, payload: RefreshRequest, db: DBSession) -> TokenResponse:
    stmt = select(User).where(User.refresh_token == payload.refresh_token)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    now = datetime.now(UTC)
    expires_at = user.refresh_token_expires_at
    # SQLite returns timezone-naive datetimes; treat as UTC for comparison
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at is None or expires_at < now:
        user.refresh_token = None
        user.refresh_token_expires_at = None
        await db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # Token rotation: invalidate old, issue new pair
    tokens = _issue_tokens(user)
    await db.commit()
    return tokens


@router.post("/logout", status_code=204)
async def logout(db: DBSession, user_id: CurrentUserID) -> Response:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user:
        user.refresh_token = None
        user.refresh_token_expires_at = None
        await db.commit()
    return Response(status_code=204)


@router.post("/forgot-password", status_code=204)
@limiter.limit(settings.rate_limit_auth)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def forgot_password(
    request: Request, payload: PasswordResetRequest, db: DBSession
) -> Response:
    stmt = select(User).where(User.email == payload.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        token = create_password_reset_token()
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now(UTC) + timedelta(
            minutes=settings.password_reset_expire_minutes
        )
        await db.commit()
        # In production, send email with reset link.
        # For now, log the token for development use.
        reset_url = f"{settings.frontend_base_url}/reset-password?token={token}"
        logger.info("Password reset requested for %s: %s", payload.email, reset_url)

    # Always return 204 to prevent email enumeration
    return Response(status_code=204)


@router.post("/reset-password", status_code=204)
@limiter.limit(settings.rate_limit_auth)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def reset_password(
    request: Request, payload: PasswordResetConfirm, db: DBSession
) -> Response:
    stmt = select(User).where(User.password_reset_token == payload.token)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    now = datetime.now(UTC)
    reset_expires = user.password_reset_expires_at
    # SQLite returns timezone-naive datetimes; treat as UTC for comparison
    if reset_expires is not None and reset_expires.tzinfo is None:
        reset_expires = reset_expires.replace(tzinfo=UTC)
    if reset_expires is None or reset_expires < now:
        user.password_reset_token = None
        user.password_reset_expires_at = None
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.hashed_password = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await db.commit()
    return Response(status_code=204)


@router.get("/me", response_model=UserResponse)
async def get_me(db: DBSession, user_id: CurrentUserID) -> UserResponse:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
    )


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest, db: DBSession, user_id: CurrentUserID
) -> UserResponse:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.display_name = payload.display_name
    await db.commit()
    await db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
    )


@router.put("/me/password", status_code=204)
async def change_password(
    payload: ChangePasswordRequest, db: DBSession, user_id: CurrentUserID
) -> Response:
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return Response(status_code=204)


@router.delete("/me", status_code=204)
async def delete_account(
    payload: DeleteAccountRequest, db: DBSession, user_id: CurrentUserID
) -> Response:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.documents),
            selectinload(User.quiz_attempts),
            selectinload(User.wrong_answer_notes),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Password is incorrect")

    await db.delete(user)
    await db.commit()
    return Response(status_code=204)
