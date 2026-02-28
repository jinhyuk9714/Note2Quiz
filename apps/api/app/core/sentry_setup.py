from __future__ import annotations

import logging
from typing import Any

import sentry_sdk
from fastapi import HTTPException
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.types import Event, Hint

from app.core.config import settings

logger = logging.getLogger(__name__)


def _before_send(event: Event, hint: Hint) -> Event | None:
    """Filter out expected client errors to save Sentry quota."""
    exc_info: Any = hint.get("exc_info")
    if exc_info is not None:
        exc: Any = exc_info[1]
        if isinstance(exc, HTTPException) and exc.status_code < 500:
            return None
    return event


def _traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Skip health check transactions to save quota."""
    asgi_scope: dict[str, Any] = sampling_context.get("asgi_scope", {})
    path: str = asgi_scope.get("path", "")
    if path.startswith("/health"):
        return 0.0
    return settings.sentry_traces_sample_rate


def init_sentry() -> None:
    if not settings.sentry_dsn:
        logger.info("Sentry DSN not configured, skipping initialization")
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sampler=_traces_sampler,
        before_send=_before_send,  # type: ignore[arg-type]
        send_default_pii=False,
    )
    logger.info("Sentry initialized (env=%s)", settings.sentry_environment)
