from __future__ import annotations

import logging
import time
import uuid

from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

logger = logging.getLogger("app.middleware.request")


def _extract_user_id(request: Request) -> str | None:
    """Best-effort user_id extraction from JWT for logging only."""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:]
    try:
        from app.services.auth_service import decode_access_token

        return decode_access_token(token)
    except Exception:
        return None


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every request/response with method, path, status, duration, user."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = uuid.uuid4().hex[:8]
        start = time.monotonic()
        user_id = _extract_user_id(request)
        client_ip = request.client.host if request.client else "unknown"

        request.state.request_id = request_id

        if user_id:
            import sentry_sdk

            sentry_sdk.set_user({"id": user_id})

        extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "user_id": user_id,
            "client_ip": client_ip,
        }

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = round((time.monotonic() - start) * 1000, 2)
            logger.exception(
                "Unhandled exception",
                extra={**extra, "status_code": 500, "duration_ms": duration_ms},
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )

        duration_ms = round((time.monotonic() - start) * 1000, 2)

        log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
        if request.url.path == "/health":
            log_level = logging.DEBUG

        logger.log(
            log_level,
            "%s %s -> %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={**extra, "status_code": response.status_code, "duration_ms": duration_ms},
        )

        response.headers["X-Request-ID"] = request_id
        return response


def register_exception_handler(app: FastAPI) -> None:
    """Register a global catch-all for unhandled exceptions."""

    @app.exception_handler(Exception)
    async def _unhandled_exception_handler(  # pyright: ignore[reportUnusedFunction]
        request: Request, exc: Exception
    ) -> JSONResponse:
        request_id: str = getattr(request.state, "request_id", "unknown")
        logger.exception(
            "Unhandled exception: %s",
            str(exc),
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
            },
        )
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
