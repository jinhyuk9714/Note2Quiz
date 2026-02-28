from __future__ import annotations

import json
import uuid
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
    mock_block = MagicMock()
    mock_block.text = MOCK_QUIZ_RESPONSE

    mock_response = MagicMock()
    mock_response.content = [mock_block]

    mock_client = AsyncMock()
    mock_client.messages.create = AsyncMock(return_value=mock_response)

    mock_cls = MagicMock(return_value=mock_client)
    return mock_cls, mock_client


def _parse_sse_events(text: str) -> list[tuple[str, dict[str, object]]]:
    """Parse SSE text into list of (event_type, data_dict) tuples."""
    events: list[tuple[str, dict[str, object]]] = []
    current_event = ""
    for line in text.split("\n"):
        if line.startswith("event: "):
            current_event = line[7:].strip()
        elif line.startswith("data: ") and current_event:
            data = json.loads(line[6:])
            events.append((current_event, data))
            current_event = ""
    return events


class TestGenerateQuizStream:
    async def test_stream_emits_progress_and_complete(self, client: AsyncClient) -> None:
        _, mock_client = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Stream Test",
                "text": "Long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.api.routes.quiz.create_llm_client", return_value=mock_client),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            resp = await client.post(
                "/api/quiz/generate-stream",
                json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
            )

        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")

        events = _parse_sse_events(resp.text)

        progress_events = [e for e in events if e[0] == "progress"]
        complete_events = [e for e in events if e[0] == "complete"]

        assert len(progress_events) >= 1
        assert progress_events[0][1]["step"] == "analyzing"
        assert progress_events[0][1]["current"] == 1

        # Last progress should be saving
        assert progress_events[-1][1]["step"] == "saving"

        assert len(complete_events) == 1
        assert "quiz_id" in complete_events[0][1]
        assert complete_events[0][1]["item_count"] == 1

    async def test_stream_nonexistent_document_returns_404(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/quiz/generate-stream",
            json={
                "document_id": str(uuid.uuid4()),
                "n_questions": 1,
                "quiz_types": ["mcq"],
            },
        )
        assert resp.status_code == 404

    async def test_stream_creates_quiz_in_db(self, client: AsyncClient) -> None:
        _, mock_client = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "DB Check",
                "text": "Long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.api.routes.quiz.create_llm_client", return_value=mock_client),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            resp = await client.post(
                "/api/quiz/generate-stream",
                json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
            )

        events = _parse_sse_events(resp.text)
        complete_event = next(e for e in events if e[0] == "complete")
        quiz_id = complete_event[1]["quiz_id"]

        # Verify quiz exists via GET endpoint
        get_resp = await client.get(f"/api/quiz/{quiz_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["item_count"] == 1

    async def test_stream_other_user_document_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Private",
                "text": "Long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        resp = await second_client.post(
            "/api/quiz/generate-stream",
            json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
        )
        assert resp.status_code == 404

    async def test_stream_progress_message_contains_chunk_info(self, client: AsyncClient) -> None:
        _, mock_client = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Progress Msg",
                "text": "Long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.api.routes.quiz.create_llm_client", return_value=mock_client),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            resp = await client.post(
                "/api/quiz/generate-stream",
                json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
            )

        events = _parse_sse_events(resp.text)
        analyzing = [e for e in events if e[0] == "progress" and e[1]["step"] == "analyzing"]
        assert len(analyzing) >= 1
        assert "분석 중" in str(analyzing[0][1]["message"])

    async def test_stream_with_focus_concepts(self, client: AsyncClient) -> None:
        _, mock_client = _mock_anthropic()

        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Focus Test",
                "text": "Long enough material for quiz generation testing purposes.",
            },
        )
        doc_id = doc_resp.json()["id"]

        with (
            patch("app.api.routes.quiz.create_llm_client", return_value=mock_client),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            resp = await client.post(
                "/api/quiz/generate-stream",
                json={
                    "document_id": doc_id,
                    "n_questions": 1,
                    "quiz_types": ["mcq"],
                    "focus_concepts": ["미적분"],
                },
            )

        assert resp.status_code == 200

        # Verify LLM prompt contained focus concepts
        call_args = mock_client.messages.create.call_args
        prompt_content = call_args.kwargs["messages"][0]["content"]
        assert "Focus concepts" in prompt_content
        assert "미적분" in prompt_content

        events = _parse_sse_events(resp.text)
        complete_events = [e for e in events if e[0] == "complete"]
        assert len(complete_events) == 1

        # Verify title includes focus concept
        quiz_id = complete_events[0][1]["quiz_id"]
        get_resp = await client.get(f"/api/quiz/{quiz_id}")
        assert get_resp.status_code == 200
        assert "미적분" in get_resp.json()["title"]
        assert "집중 퀴즈" in get_resp.json()["title"]
