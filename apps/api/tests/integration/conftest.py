from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_session_factory
from app.main import app


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


MOCK_MCQ_ITEMS = json.dumps(
    [
        {
            "quiz_type": "mcq",
            "question": "What is 2+2?",
            "correct_answer": "A",
            "explanation": "Basic arithmetic.",
            "options": {"A": "4", "B": "3", "C": "5", "D": "6"},
            "concept_tags": ["arithmetic"],
            "difficulty": 1,
        }
    ]
)


def mock_llm(response_text: str = MOCK_MCQ_ITEMS) -> AsyncMock:
    """Create a mocked LLM client that returns the given response text."""
    mock_block = MagicMock()
    mock_block.text = response_text

    mock_response = MagicMock()
    mock_response.content = [mock_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)
    return mock_client


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
    mock_response: str = MOCK_MCQ_ITEMS,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Generate a quiz with mocked LLM, return the quiz response dict."""
    llm = mock_llm(mock_response)
    with (
        patch("app.services.quiz_generation.create_llm_client", return_value=llm),
        patch(
            "app.services.quiz_generation.isinstance",
            side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
        ),
    ):
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
