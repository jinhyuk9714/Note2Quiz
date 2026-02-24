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


async def _make_quiz(client: AsyncClient) -> dict[str, Any]:
    """Create a document + quiz using mocked Anthropic, return quiz dict."""
    mock_cls, _ = _mock_anthropic()
    doc_resp = await client.post(
        "/api/documents/",
        data={
            "title": "QuizSource",
            "text": "Long enough material for quiz generation testing purposes.",
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
            json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
        )
    return quiz_resp.json()


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


class TestListQuizzes:
    async def test_empty_list(self, client: AsyncClient) -> None:
        resp = await client.get("/api/quiz/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_after_create(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        resp = await client.get("/api/quiz/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["id"] == quiz["id"]
        assert "items" not in data[0]
        assert "document_id" in data[0]


class TestDeleteQuiz:
    async def test_delete_existing_returns_204(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        quiz_id = quiz["id"]

        resp = await client.delete(f"/api/quiz/{quiz_id}")
        assert resp.status_code == 204

        get_resp = await client.get(f"/api/quiz/{quiz_id}")
        assert get_resp.status_code == 404

    async def test_delete_nonexistent_returns_404(self, client: AsyncClient) -> None:
        resp = await client.delete(f"/api/quiz/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_delete_document_cascades_to_quiz(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        quiz_id = quiz["id"]

        list_resp = await client.get("/api/quiz/")
        doc_id = list_resp.json()[0]["document_id"]

        await client.delete(f"/api/documents/{doc_id}")

        get_resp = await client.get(f"/api/quiz/{quiz_id}")
        assert get_resp.status_code == 404


class TestQuizOwnership:
    """Test that quiz endpoints enforce document ownership."""

    async def test_get_quiz_of_another_user_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        resp = await second_client.get(f"/api/quiz/{quiz['id']}")
        assert resp.status_code == 404

    async def test_generate_quiz_from_another_users_doc_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        doc_resp = await client.post(
            "/api/documents/",
            data={"title": "Private Doc", "text": "Enough text for document processing testing."},
        )
        doc_id = doc_resp.json()["id"]

        resp = await second_client.post(
            "/api/quiz/generate",
            json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
        )
        assert resp.status_code == 404

    async def test_submit_quiz_of_another_user_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        item_id = quiz["items"][0]["id"]

        resp = await second_client.post(
            f"/api/quiz/{quiz['id']}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "A"}]},
        )
        assert resp.status_code == 404

    async def test_delete_quiz_of_another_user_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        resp = await second_client.delete(f"/api/quiz/{quiz['id']}")
        assert resp.status_code == 404

    async def test_list_quizzes_only_returns_own(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        await _make_quiz(client)
        resp = await second_client.get("/api/quiz/")
        assert resp.status_code == 200
        assert resp.json() == []


class TestQuizInputValidation:
    async def test_invalid_quiz_type_returns_422(self, client: AsyncClient) -> None:
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Validation Test",
                "text": "Enough text for document processing testing.",
            },
        )
        doc_id = doc_resp.json()["id"]

        resp = await client.post(
            "/api/quiz/generate",
            json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["banana"]},
        )
        assert resp.status_code == 422

    async def test_user_answer_too_long_returns_422(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        item_id = quiz["items"][0]["id"]

        resp = await client.post(
            f"/api/quiz/{quiz['id']}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "A" * 1001}]},
        )
        assert resp.status_code == 422
