from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from httpx import AsyncClient

MOCK_QUIZ_RESPONSE = json.dumps(
    [
        {
            "quiz_type": "mcq",
            "question": "What is 2+2?",
            "correct_answer": "A",
            "explanation": "Basic math.",
            "options": {"A": "4", "B": "3", "C": "5", "D": "6"},
            "concept_tags": ["math", "arithmetic"],
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


class TestDashboardStats:
    async def test_empty_stats(self, client: AsyncClient) -> None:
        resp = await client.get("/api/dashboard/stats")
        assert resp.status_code == 200
        data = resp.json()

        lp = data["learning_progress"]
        assert lp["total_quizzes_taken"] == 0
        assert lp["accuracy_rate"] == 0.0
        assert lp["documents_studied"] == 0

        assert data["weak_concepts"] == []

        rs = data["review_schedule"]
        assert rs["overdue_count"] == 0
        assert rs["today_count"] == 0
        assert rs["upcoming"] == []

    async def test_stats_after_wrong_answer(self, client: AsyncClient) -> None:
        mock_cls = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Dashboard Test",
                "text": "Enough text material for creating a quiz for dashboard testing.",
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

        resp = await client.get("/api/dashboard/stats")
        assert resp.status_code == 200
        data = resp.json()

        lp = data["learning_progress"]
        assert lp["total_quizzes_taken"] == 1
        assert lp["total_questions_answered"] == 1
        assert lp["total_correct"] == 0
        assert lp["accuracy_rate"] == 0.0
        assert lp["documents_studied"] == 1

        tags = [c["tag"] for c in data["weak_concepts"]]
        assert "math" in tags
        assert "arithmetic" in tags

        rs = data["review_schedule"]
        total_scheduled = rs["overdue_count"] + rs["today_count"]
        total_scheduled += sum(d["count"] for d in rs["upcoming"])
        assert total_scheduled >= 1

    async def test_accuracy_with_correct_answer(self, client: AsyncClient) -> None:
        mock_cls = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Accuracy Test",
                "text": "Enough text material for creating a quiz for accuracy testing.",
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
                        "user_answer": "A",  # matches MOCK_QUIZ_RESPONSE correct_answer
                    }
                ]
            },
        )

        resp = await client.get("/api/dashboard/stats")
        data = resp.json()
        assert data["learning_progress"]["accuracy_rate"] == 1.0
        assert data["weak_concepts"] == []


class TestDashboardTrends:
    async def test_empty_trends(self, client: AsyncClient) -> None:
        resp = await client.get("/api/dashboard/trends")
        assert resp.status_code == 200
        data = resp.json()
        assert data["daily_quiz_trend"] == []
        assert data["days"] == 30

    async def test_trends_after_attempt(self, client: AsyncClient) -> None:
        mock_cls = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Trends Test",
                "text": "Enough text material for creating a quiz for trends testing.",
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
                        "user_answer": "A",
                    }
                ]
            },
        )

        resp = await client.get("/api/dashboard/trends")
        assert resp.status_code == 200
        data = resp.json()

        trend = data["daily_quiz_trend"]
        assert len(trend) >= 1
        today_point = trend[-1]
        assert today_point["quiz_count"] >= 1
        assert today_point["questions_answered"] >= 1
        assert today_point["accuracy_rate"] == 1.0

    async def test_days_parameter(self, client: AsyncClient) -> None:
        resp = await client.get("/api/dashboard/trends?days=7")
        assert resp.status_code == 200
        assert resp.json()["days"] == 7

    async def test_days_validation(self, client: AsyncClient) -> None:
        resp = await client.get("/api/dashboard/trends?days=3")
        assert resp.status_code == 422
