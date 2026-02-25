from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient

MOCK_QUIZ_RESPONSE = json.dumps(
    [
        {
            "quiz_type": "mcq",
            "question": "Sample Q?",
            "correct_answer": "A",
            "explanation": "Explanation.",
            "options": {"A": "4", "B": "3", "C": "5", "D": "6"},
            "concept_tags": ["test"],
            "difficulty": 1,
        }
    ]
)


def _mock_anthropic() -> MagicMock:
    mock_block = MagicMock()
    mock_block.text = MOCK_QUIZ_RESPONSE
    mock_response = MagicMock()
    mock_response.content = [mock_block]
    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)
    return MagicMock(return_value=mock_client)


class TestListWrongNotes:
    async def test_empty_list(self, client: AsyncClient) -> None:
        resp = await client.get("/api/wrong-notes/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["notes"] == []
        assert data["total"] == 0

    async def test_due_only_filter(self, client: AsyncClient) -> None:
        resp = await client.get("/api/wrong-notes/?due_only=true")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0


class TestMasteredFilter:
    async def _create_and_master_note(self, client: AsyncClient) -> str:
        """Create a wrong note and review it 5 times to master it."""
        mock_cls = _mock_anthropic()
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Master Test",
                "text": "Enough text material for creating a quiz for mastery testing.",
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
        quiz_data = quiz_resp.json()
        await client.post(
            f"/api/quiz/{quiz_data['id']}/submit",
            json={
                "answers": [{"quiz_item_id": quiz_data["items"][0]["id"], "user_answer": "WRONG"}]
            },
        )
        notes_resp = await client.get("/api/wrong-notes/")
        note_id = notes_resp.json()["notes"][0]["id"]

        # Review correct 5 times to trigger mastery
        for _ in range(5):
            await client.post(
                f"/api/wrong-notes/{note_id}/review",
                json={"is_correct": True},
            )
        return note_id

    async def test_default_excludes_mastered(self, client: AsyncClient) -> None:
        await self._create_and_master_note(client)
        resp = await client.get("/api/wrong-notes/")
        assert resp.json()["total"] == 0

    async def test_mastered_filter_returns_only_mastered(self, client: AsyncClient) -> None:
        note_id = await self._create_and_master_note(client)
        resp = await client.get("/api/wrong-notes/?is_mastered=true")
        data = resp.json()
        assert data["total"] == 1
        assert data["notes"][0]["id"] == note_id
        assert data["notes"][0]["is_mastered"] is True

    async def test_mastered_false_explicit(self, client: AsyncClient) -> None:
        await self._create_and_master_note(client)
        resp = await client.get("/api/wrong-notes/?is_mastered=false")
        assert resp.json()["total"] == 0


class TestReviewWrongNote:
    async def test_review_nonexistent_returns_404(self, client: AsyncClient) -> None:
        resp = await client.post(
            f"/api/wrong-notes/{uuid.uuid4()}/review",
            json={"is_correct": True},
        )
        assert resp.status_code == 404

    async def test_review_correct_increments_streak(self, client: AsyncClient) -> None:
        mock_cls = _mock_anthropic()

        # Create doc → quiz → submit wrong answer → get wrong note
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Review Test",
                "text": "Enough text material for creating a quiz for review testing.",
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
        quiz_data = quiz_resp.json()

        await client.post(
            f"/api/quiz/{quiz_data['id']}/submit",
            json={
                "answers": [
                    {
                        "quiz_item_id": quiz_data["items"][0]["id"],
                        "user_answer": "WRONG",
                    }
                ]
            },
        )

        notes_resp = await client.get("/api/wrong-notes/")
        note_id = notes_resp.json()["notes"][0]["id"]

        # Review as correct
        resp = await client.post(
            f"/api/wrong-notes/{note_id}/review",
            json={"is_correct": True},
        )
        assert resp.status_code == 200
        assert resp.json()["consecutive_correct"] == 1
        assert resp.json()["is_mastered"] is False


class TestWrongNotesSearchAndPagination:
    async def _create_wrong_note(self, client: AsyncClient) -> None:
        mock_cls = _mock_anthropic()
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "WN Test",
                "text": "Enough text material for creating a quiz for wrong note testing.",
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
        quiz_data = quiz_resp.json()
        await client.post(
            f"/api/quiz/{quiz_data['id']}/submit",
            json={
                "answers": [{"quiz_item_id": quiz_data["items"][0]["id"], "user_answer": "WRONG"}]
            },
        )

    async def test_total_is_correct_with_pagination(self, client: AsyncClient) -> None:
        # Create 3 wrong notes
        for _ in range(3):
            await self._create_wrong_note(client)

        # Request with small limit
        resp = await client.get("/api/wrong-notes/?limit=2&offset=0")
        data = resp.json()
        assert data["total"] == 3  # Total should be 3, not len(page)
        assert len(data["notes"]) == 2
        assert data["limit"] == 2
        assert data["offset"] == 0

    async def test_search_by_question(self, client: AsyncClient) -> None:
        await self._create_wrong_note(client)

        # Mock question is "Sample Q?"
        resp = await client.get("/api/wrong-notes/?search=Sample")
        assert resp.json()["total"] == 1

        resp2 = await client.get("/api/wrong-notes/?search=nonexistent")
        assert resp2.json()["total"] == 0
