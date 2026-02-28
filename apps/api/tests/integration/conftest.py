from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_session_factory
from app.main import app
from tests.api.test_quiz import mock_quiz_pipeline


@pytest.fixture
async def anon_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Unauthenticated client for signup/login flows."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_session_factory] = lambda: None  # type: ignore[assignment]

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


async def create_document(
    client: AsyncClient,
    title: str = "Integration Test Doc",
    headers: dict[str, str] | None = None,
) -> str:
    """Upload a text document, return its ID."""
    resp = await client.post(
        "/api/documents/",
        data={
            "title": title,
            "text": "Long enough material for integration testing of quiz generation.",
        },
        headers=headers or {},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def generate_quiz(
    client: AsyncClient,
    document_id: str,
    n_questions: int = 1,
    quiz_types: list[str] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Generate a quiz with mocked LLM, return the quiz response dict."""
    with mock_quiz_pipeline():
        resp = await client.post(
            "/api/quiz/generate",
            json={
                "document_id": document_id,
                "n_questions": n_questions,
                "quiz_types": quiz_types or ["mcq"],
            },
            headers=headers or {},
        )
    assert resp.status_code == 201
    return resp.json()
