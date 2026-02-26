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

MOCK_SHORT_ANSWER_RESPONSE = json.dumps(
    [
        {
            "quiz_type": "short_answer",
            "question": "What is the powerhouse of the cell?",
            "correct_answer": "mitochondria",
            "explanation": "Mitochondria produce ATP through cellular respiration.",
            "concept_tags": ["biology"],
            "difficulty": 1,
        }
    ]
)


def _mock_anthropic(response_text: str = MOCK_QUIZ_RESPONSE) -> tuple[MagicMock, AsyncMock]:
    """Return (patched_cls, mock_client_instance) for Anthropic API mock."""
    mock_block = MagicMock()
    mock_block.text = response_text

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


class TestQuizTitle:
    async def test_auto_generated_title(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        assert quiz["title"] == "QuizSource 퀴즈"

    async def test_custom_title(self, client: AsyncClient) -> None:
        mock_cls, _ = _mock_anthropic()
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "My Document",
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
            resp = await client.post(
                "/api/quiz/generate",
                json={
                    "document_id": doc_id,
                    "n_questions": 1,
                    "quiz_types": ["mcq"],
                    "title": "My Custom Quiz",
                },
            )
        assert resp.status_code == 201
        assert resp.json()["title"] == "My Custom Quiz"

    async def test_list_includes_document_title(self, client: AsyncClient) -> None:
        await _make_quiz(client)
        resp = await client.get("/api/quiz/")
        items = resp.json()["items"]
        assert len(items) >= 1
        assert items[0]["document_title"] == "QuizSource"


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
            json={
                "answers": [{"quiz_item_id": item["id"], "user_answer": "A"}]
            },  # "A" matches MOCK_QUIZ_RESPONSE
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
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_after_create(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        resp = await client.get("/api/quiz/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["id"] == quiz["id"]
        assert "items" not in data["items"][0]
        assert "document_id" in data["items"][0]


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
        doc_id = list_resp.json()["items"][0]["document_id"]

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
        assert resp.json()["items"] == []


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


class TestQuizRetake:
    """Test retake / attempt_number functionality."""

    async def test_submit_multiple_times_increments_attempt_number(
        self, client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        quiz_id = quiz["id"]
        item = quiz["items"][0]
        answers = {"answers": [{"quiz_item_id": item["id"], "user_answer": "A"}]}

        resp1 = await client.post(f"/api/quiz/{quiz_id}/submit", json=answers)
        assert resp1.status_code == 201
        assert resp1.json()["attempt_number"] == 1

        resp2 = await client.post(f"/api/quiz/{quiz_id}/submit", json=answers)
        assert resp2.status_code == 201
        assert resp2.json()["attempt_number"] == 2

        resp3 = await client.post(f"/api/quiz/{quiz_id}/submit", json=answers)
        assert resp3.status_code == 201
        assert resp3.json()["attempt_number"] == 3


class TestQuizAttempts:
    """Test GET /quiz/{id}/attempts endpoint."""

    async def test_list_attempts_returns_history(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        quiz_id = quiz["id"]
        item = quiz["items"][0]
        answers = {"answers": [{"quiz_item_id": item["id"], "user_answer": "A"}]}

        await client.post(f"/api/quiz/{quiz_id}/submit", json=answers)
        await client.post(f"/api/quiz/{quiz_id}/submit", json=answers)

        resp = await client.get(f"/api/quiz/{quiz_id}/attempts")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        # Most recent first
        assert data[0]["attempt_number"] == 2
        assert data[1]["attempt_number"] == 1

    async def test_list_attempts_empty(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        resp = await client.get(f"/api/quiz/{quiz['id']}/attempts")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_attempts_nonexistent_quiz_returns_404(self, client: AsyncClient) -> None:
        resp = await client.get(f"/api/quiz/{uuid.uuid4()}/attempts")
        assert resp.status_code == 404

    async def test_list_attempts_other_user_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        resp = await second_client.get(f"/api/quiz/{quiz['id']}/attempts")
        assert resp.status_code == 404


class TestQuizListWithScores:
    """Test that quiz list includes attempt info."""

    async def test_list_includes_attempt_info(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        item = quiz["items"][0]
        await client.post(
            f"/api/quiz/{quiz['id']}/submit",
            json={
                "answers": [{"quiz_item_id": item["id"], "user_answer": "A"}]
            },  # "A" matches MOCK_QUIZ_RESPONSE
        )

        resp = await client.get("/api/quiz/")
        assert resp.status_code == 200
        data = resp.json()["items"]
        assert data[0]["attempt_count"] == 1
        assert data[0]["latest_score"] == 1
        assert data[0]["latest_total"] == 1

    async def test_list_no_attempts_shows_zero(self, client: AsyncClient) -> None:
        await _make_quiz(client)
        resp = await client.get("/api/quiz/")
        data = resp.json()["items"]
        assert data[0]["attempt_count"] == 0
        assert data[0]["latest_score"] is None
        assert data[0]["latest_total"] is None


class TestQuizSearchAndPagination:
    """Test search, filter, sort and pagination on quiz list."""

    async def test_search_by_title(self, client: AsyncClient) -> None:
        # _make_quiz creates quizzes with auto title "QuizSource 퀴즈"
        await _make_quiz(client)
        await _make_quiz(client)

        resp = await client.get("/api/quiz/?search=QuizSource")
        data = resp.json()
        assert data["total"] == 2

        resp2 = await client.get("/api/quiz/?search=nonexistent")
        assert resp2.json()["total"] == 0

    async def test_pagination(self, client: AsyncClient) -> None:
        for _ in range(3):
            await _make_quiz(client)

        resp = await client.get("/api/quiz/?limit=2&offset=0")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 2
        assert data["limit"] == 2

        resp2 = await client.get("/api/quiz/?limit=2&offset=2")
        assert len(resp2.json()["items"]) == 1

    async def test_filter_by_document_id(self, client: AsyncClient) -> None:
        await _make_quiz(client)

        list_resp = await client.get("/api/quiz/")
        actual_doc_id = list_resp.json()["items"][0]["document_id"]

        resp = await client.get(f"/api/quiz/?document_id={actual_doc_id}")
        assert resp.json()["total"] >= 1

        resp2 = await client.get(f"/api/quiz/?document_id={uuid.uuid4()}")
        assert resp2.json()["total"] == 0


async def _make_quiz_with_title(
    client: AsyncClient, title: str, doc_title: str = "Doc"
) -> dict[str, Any]:
    """Create a document + quiz with a specific title."""
    mock_cls, _ = _mock_anthropic()
    doc_resp = await client.post(
        "/api/documents/",
        data={
            "title": doc_title,
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
            json={
                "document_id": doc_id,
                "n_questions": 1,
                "quiz_types": ["mcq"],
                "title": title,
            },
        )
    return quiz_resp.json()


async def _submit_quiz(
    client: AsyncClient, quiz: dict[str, Any], answer: str = "A"
) -> dict[str, Any]:
    """Submit an answer to a quiz and return the result."""
    item = quiz["items"][0]
    resp = await client.post(
        f"/api/quiz/{quiz['id']}/submit",
        json={"answers": [{"quiz_item_id": item["id"], "user_answer": answer}]},
    )
    return resp.json()


class TestQuizFilters:
    """Test attempt_status, score_min, score_max, and extended sort_by filters."""

    async def test_attempt_status_not_attempted(self, client: AsyncClient) -> None:
        quiz_a = await _make_quiz_with_title(client, "QuizA")
        await _make_quiz_with_title(client, "QuizB")
        # Submit only QuizA
        await _submit_quiz(client, quiz_a, "A")

        resp = await client.get("/api/quiz/?attempt_status=not_attempted")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "QuizB"

    async def test_attempt_status_attempted(self, client: AsyncClient) -> None:
        quiz_a = await _make_quiz_with_title(client, "QuizA")
        await _make_quiz_with_title(client, "QuizB")
        await _submit_quiz(client, quiz_a, "A")

        resp = await client.get("/api/quiz/?attempt_status=attempted")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "QuizA"

    async def test_score_filter_high(self, client: AsyncClient) -> None:
        quiz = await _make_quiz_with_title(client, "Perfect")
        await _submit_quiz(client, quiz, "A")  # 1/1 = 100%

        resp = await client.get("/api/quiz/?score_min=90")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Perfect"

    async def test_score_filter_low(self, client: AsyncClient) -> None:
        quiz = await _make_quiz_with_title(client, "Failed")
        await _submit_quiz(client, quiz, "WRONG")  # 0/1 = 0%

        resp = await client.get("/api/quiz/?score_min=0&score_max=70")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "Failed"

    async def test_score_filter_excludes_unattempted(self, client: AsyncClient) -> None:
        await _make_quiz_with_title(client, "Unattempted")

        resp = await client.get("/api/quiz/?score_min=0&score_max=70")
        data = resp.json()
        assert data["total"] == 0

    async def test_sort_by_item_count(self, client: AsyncClient) -> None:
        await _make_quiz_with_title(client, "QuizA")
        await _make_quiz_with_title(client, "QuizB")

        resp = await client.get("/api/quiz/?sort_by=item_count&order=desc")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 2

    async def test_sort_by_latest_score(self, client: AsyncClient) -> None:
        quiz_perfect = await _make_quiz_with_title(client, "Perfect")
        quiz_fail = await _make_quiz_with_title(client, "Fail")
        await _submit_quiz(client, quiz_perfect, "A")  # 100%
        await _submit_quiz(client, quiz_fail, "WRONG")  # 0%

        resp = await client.get("/api/quiz/?sort_by=latest_score&order=desc")
        data = resp.json()
        assert data["items"][0]["title"] == "Perfect"
        assert data["items"][1]["title"] == "Fail"

    async def test_combined_filters(self, client: AsyncClient) -> None:
        quiz_a = await _make_quiz_with_title(client, "QuizA")
        quiz_b = await _make_quiz_with_title(client, "QuizB")
        await _submit_quiz(client, quiz_a, "A")  # 100%
        await _submit_quiz(client, quiz_b, "WRONG")  # 0%

        # attempted + high score
        resp = await client.get("/api/quiz/?attempt_status=attempted&score_min=90")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["title"] == "QuizA"


async def _make_short_answer_quiz(client: AsyncClient) -> dict[str, Any]:
    """Create a document + short_answer quiz using mocked Anthropic."""
    mock_cls, _ = _mock_anthropic(MOCK_SHORT_ANSWER_RESPONSE)
    doc_resp = await client.post(
        "/api/documents/",
        data={
            "title": "Biology Notes",
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
            json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["short_answer"]},
        )
    return quiz_resp.json()


class TestSemanticGrading:
    """Test semantic grading for short_answer / fill_blank quiz types."""

    async def test_exact_match_no_semantic_call(self, client: AsyncClient) -> None:
        """If exact match succeeds for short_answer, no semantic grading needed."""
        quiz = await _make_short_answer_quiz(client)
        item = quiz["items"][0]

        with patch("app.services.wrong_note_service.grade_answers_semantically") as mock_grade:
            resp = await client.post(
                f"/api/quiz/{quiz['id']}/submit",
                json={"answers": [{"quiz_item_id": item["id"], "user_answer": "mitochondria"}]},
            )
        assert resp.status_code == 201
        assert resp.json()["score"] == 1
        mock_grade.assert_not_called()

    async def test_semantic_correct_answer(self, client: AsyncClient) -> None:
        """A semantically correct answer should be graded True."""
        quiz = await _make_short_answer_quiz(client)
        item = quiz["items"][0]

        with patch(
            "app.services.wrong_note_service.grade_answers_semantically",
            return_value={item["id"]: True},
        ):
            resp = await client.post(
                f"/api/quiz/{quiz['id']}/submit",
                json={
                    "answers": [{"quiz_item_id": item["id"], "user_answer": "the mitochondrion"}]
                },
            )
        assert resp.status_code == 201
        result = resp.json()
        assert result["score"] == 1
        assert result["wrong_notes_created"] == 0
        assert result["results"][0]["grading_method"] == "semantic"

    async def test_semantic_wrong_answer(self, client: AsyncClient) -> None:
        """A semantically wrong answer should create a wrong note."""
        quiz = await _make_short_answer_quiz(client)
        item = quiz["items"][0]

        with patch(
            "app.services.wrong_note_service.grade_answers_semantically",
            return_value={item["id"]: False},
        ):
            resp = await client.post(
                f"/api/quiz/{quiz['id']}/submit",
                json={"answers": [{"quiz_item_id": item["id"], "user_answer": "ribosome"}]},
            )
        assert resp.status_code == 201
        result = resp.json()
        assert result["score"] == 0
        assert result["wrong_notes_created"] == 1
        assert result["results"][0]["grading_method"] == "semantic"

    async def test_mcq_never_uses_semantic(self, client: AsyncClient) -> None:
        """MCQ should never trigger semantic grading, even on wrong answer."""
        quiz = await _make_quiz(client)
        item = quiz["items"][0]

        with patch("app.services.wrong_note_service.grade_answers_semantically") as mock_grade:
            resp = await client.post(
                f"/api/quiz/{quiz['id']}/submit",
                json={"answers": [{"quiz_item_id": item["id"], "user_answer": "WRONG"}]},
            )
        assert resp.status_code == 201
        assert resp.json()["score"] == 0
        mock_grade.assert_not_called()

    async def test_api_failure_falls_back_to_exact(self, client: AsyncClient) -> None:
        """If semantic grading API fails, fall back to exact match (wrong)."""
        quiz = await _make_short_answer_quiz(client)
        item = quiz["items"][0]

        with patch(
            "app.services.wrong_note_service.grade_answers_semantically",
            return_value={},
        ):
            resp = await client.post(
                f"/api/quiz/{quiz['id']}/submit",
                json={
                    "answers": [{"quiz_item_id": item["id"], "user_answer": "the mitochondrion"}]
                },
            )
        assert resp.status_code == 201
        result = resp.json()
        assert result["score"] == 0
        assert result["results"][0]["grading_method"] == "exact_fallback"


class TestGetAttemptDetail:
    async def test_get_attempt_detail_success(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        submit_result = await _submit_quiz(client, quiz, "A")
        quiz_id = quiz["id"]
        attempt_id = submit_result["attempt_id"]

        resp = await client.get(f"/api/quiz/{quiz_id}/attempts/{attempt_id}")
        assert resp.status_code == 200
        data = resp.json()

        assert data["attempt_id"] == attempt_id
        assert data["quiz_id"] == quiz_id
        assert data["score"] == submit_result["score"]
        assert data["total"] == submit_result["total"]
        assert data["attempt_number"] == submit_result["attempt_number"]
        assert "quiz_title" in data
        assert len(data["results"]) == 1

        item_result = data["results"][0]
        assert "question" in item_result
        assert "correct_answer" in item_result
        assert "explanation" in item_result
        assert "quiz_type" in item_result
        assert "concept_tags" in item_result
        assert "difficulty" in item_result
        assert isinstance(item_result["is_correct"], bool)

    async def test_get_attempt_detail_nonexistent_attempt_returns_404(
        self, client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        resp = await client.get(f"/api/quiz/{quiz['id']}/attempts/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_get_attempt_detail_wrong_quiz_id_returns_404(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        submit_result = await _submit_quiz(client, quiz, "A")
        attempt_id = submit_result["attempt_id"]

        resp = await client.get(f"/api/quiz/{uuid.uuid4()}/attempts/{attempt_id}")
        assert resp.status_code == 404

    async def test_get_attempt_detail_other_users_attempt_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        quiz = await _make_quiz(client)
        submit_result = await _submit_quiz(client, quiz, "A")
        quiz_id = quiz["id"]
        attempt_id = submit_result["attempt_id"]

        resp = await second_client.get(f"/api/quiz/{quiz_id}/attempts/{attempt_id}")
        assert resp.status_code == 404

    async def test_get_attempt_detail_mcq_includes_options(self, client: AsyncClient) -> None:
        quiz = await _make_quiz(client)
        submit_result = await _submit_quiz(client, quiz, "A")
        quiz_id = quiz["id"]
        attempt_id = submit_result["attempt_id"]

        resp = await client.get(f"/api/quiz/{quiz_id}/attempts/{attempt_id}")
        assert resp.status_code == 200
        item_result = resp.json()["results"][0]
        assert item_result["quiz_type"] == "mcq"
        assert item_result["options"] is not None
        assert isinstance(item_result["options"], dict)
