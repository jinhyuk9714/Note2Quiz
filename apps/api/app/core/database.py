from __future__ import annotations

import logging
import time
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

logger = logging.getLogger("app.db")

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Slow query detection via SQLAlchemy core events.
# The callback signatures are fixed by SQLAlchemy — all parameters are required.
@event.listens_for(engine.sync_engine, "before_cursor_execute")
def _before_cursor_execute(  # pyright: ignore[reportUnusedFunction]
    conn: Any,
    _cursor: Any,
    _statement: str,
    _parameters: Any,
    _context: Any,
    _executemany: bool,
) -> None:
    conn.info["query_start_time"] = time.monotonic()


@event.listens_for(engine.sync_engine, "after_cursor_execute")
def _after_cursor_execute(  # pyright: ignore[reportUnusedFunction]
    conn: Any,
    _cursor: Any,
    statement: str,
    _parameters: Any,
    _context: Any,
    _executemany: bool,
) -> None:
    start: float | None = conn.info.pop("query_start_time", None)
    if start is None:
        return
    elapsed_ms = (time.monotonic() - start) * 1000
    if elapsed_ms >= settings.slow_query_threshold_ms:
        stmt_preview = statement[:200] + "..." if len(statement) > 200 else statement
        logger.warning(
            "Slow query (%.1fms): %s",
            elapsed_ms,
            stmt_preview,
            extra={"duration_ms": elapsed_ms},
        )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
