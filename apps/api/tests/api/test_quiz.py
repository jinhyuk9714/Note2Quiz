from __future__ import annotations

import json
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient

MOCK_QUIZ_RESPONSE = json.dumps(
    [
        {
            "quiz_type": "mcq",
            "question": "What is 2+2?",
            "correct_answer": "A",
            "explanation": "Basic arithmetic.",
            "options": {"A": "4", "B": "3", "C": "5", "D": "6"},
            "concept_tags": ["math"],
            "difficulty": 1,
        }
    ]
)


def _mock_anthropic() -> tuple[MagicMock, AsyncMock]:
    """Return (patched_cls, mock_client_instance) for Anthropic API mock."""
    mock_block = MagicMock()
    mock_block.text = MOCK_QUIZ_RESPONSE

    mock_response = MagicMock()
    mock_response.content = [mock_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    mock_cls = MagicMock(return_value=mock_client)
    return mock_cls, mock_client


class TestGenerateQuiz:
    async def test_generate_quiz_success(self, client: AsyncClient) -> None:
        mock_cls, _ = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Quiz Source",
                "text": "This is long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.services.quiz_generation.anthropic.AsyncAnthropic", mock_cls),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            resp = await client.post(
                "/api/quiz/generate",
                json={
                    "document_id": doc_id,
                    "n_questions": 1,
                    "quiz_types": ["mcq"],
                },
            )

        assert resp.status_code == 201
        data = resp.json()
        assert data["item_count"] >= 1
        assert len(data["items"]) >= 1

    async def test_generate_quiz_nonexistent_document(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/quiz/generate",
            json={
                "document_id": str(uuid.uuid4()),
                "n_questions": 1,
                "quiz_types": ["mcq"],
            },
        )
        assert resp.status_code == 404


class TestGetQuiz:
    async def test_get_nonexistent_quiz_returns_404(self, client: AsyncClient) -> None:
        resp = await client.get(f"/api/quiz/{uuid.uuid4()}")
        assert resp.status_code == 404


class TestSubmitQuiz:
    async def _create_quiz(self, client: AsyncClient) -> dict[str, Any]:
        mock_cls, _ = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Submit Test",
                "text": "Enough text material for creating a quiz for submission testing.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.services.quiz_generation.anthropic.AsyncAnthropic", mock_cls),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            quiz_resp = await client.post(
                "/api/quiz/generate",
                json={
                    "document_id": doc_id,
                    "n_questions": 1,
                    "quiz_types": ["mcq"],
                },
            )
        return quiz_resp.json()

    async def test_submit_correct_answer(self, client: AsyncClient) -> None:
        quiz_data = await self._create_quiz(client)
        quiz_id = quiz_data["id"]
        item = quiz_data["items"][0]

        resp = await client.post(
            f"/api/quiz/{quiz_id}/submit",
            json={"answers": [{"quiz_item_id": item["id"], "user_answer": item["correct_answer"]}]},
        )
        assert resp.status_code == 201
        result = resp.json()
        assert result["score"] == 1
        assert result["total"] == 1
        assert result["wrong_notes_created"] == 0

    async def test_submit_wrong_answer_creates_notes(self, client: AsyncClient) -> None:
        quiz_data = await self._create_quiz(client)
        quiz_id = quiz_data["id"]
        item = quiz_data["items"][0]

        resp = await client.post(
            f"/api/quiz/{quiz_id}/submit",
            json={"answers": [{"quiz_item_id": item["id"], "user_answer": "WRONG_ANSWER"}]},
        )
        assert resp.status_code == 201
        result = resp.json()
        assert result["score"] == 0
        assert result["wrong_notes_created"] == 1
