from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler  # type: ignore[import-untyped]
from slowapi.errors import RateLimitExceeded  # type: ignore[import-untyped]
from slowapi.middleware import SlowAPIMiddleware  # type: ignore[import-untyped]
from sqlalchemy import text
from starlette.middleware.gzip import GZipMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.deps import DBSession
from app.core.logging_config import setup_logging
from app.core.rate_limit import limiter
from app.core.sentry_setup import init_sentry
from app.middleware.logging_middleware import (
    RequestLoggingMiddleware,
    register_exception_handler,
)
from app.middleware.security_headers import SecurityHeadersMiddleware

setup_logging()
init_sentry()

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Application starting up")
    yield
    logger.info("Application shutting down")
    await engine.dispose()


app = FastAPI(title="Note2Quiz API", lifespan=lifespan)

# Exception handlers
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
register_exception_handler(app)

# Middleware stack (last added = outermost)
# Request flow: CORS -> RequestLogging -> SecurityHeaders -> GZip -> SlowAPI -> Route
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health", tags=["infra"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready", tags=["infra"])
async def readiness_check(db: DBSession) -> dict[str, str]:
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
