from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator
from typing import Any

os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.database import get_db
from app.core.llm_client import get_circuit_breaker
from app.main import app
from app.models import Base, User  # noqa: F401 — registers all models
from app.services.auth_service import create_access_token, hash_password

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
TEST_USER_ID_2 = uuid.UUID("00000000-0000-0000-0000-000000000002")

test_engine = create_async_engine("sqlite+aiosqlite://", echo=False)


# Enable foreign key enforcement for SQLite
@event.listens_for(test_engine.sync_engine, "connect")
def _set_sqlite_pragma(  # pyright: ignore[reportUnusedFunction]
    dbapi_connection: Any, connection_record: Any
) -> None:
    cursor: Any = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSessionFactory = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
async def setup_database() -> AsyncGenerator[None, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with TestSessionFactory() as session:
        yield session


@pytest.fixture
async def seeded_user(db_session: AsyncSession) -> User:
    user = User(
        id=TEST_USER_ID,
        email="test@example.com",
        display_name="Test User",
        hashed_password=hash_password("testpassword123"),
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
def auth_headers(seeded_user: User) -> dict[str, str]:
    """Return Authorization headers with a valid JWT for the seeded user."""
    token = create_access_token(str(seeded_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client(
    db_session: AsyncSession, auth_headers: dict[str, str]
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test", headers=auth_headers) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _reset_circuit_breaker() -> None:  # pyright: ignore[reportUnusedFunction]
    """Reset the LLM circuit breaker between tests."""
    get_circuit_breaker().reset()


@pytest.fixture
async def second_user(db_session: AsyncSession) -> User:
    user = User(
        id=TEST_USER_ID_2,
        email="other@example.com",
        display_name="Other User",
        hashed_password=hash_password("otherpassword123"),
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
def second_auth_headers(second_user: User) -> dict[str, str]:
    token = create_access_token(str(second_user.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def second_client(
    db_session: AsyncSession, second_auth_headers: dict[str, str]
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(
        transport=transport, base_url="http://test", headers=second_auth_headers
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
