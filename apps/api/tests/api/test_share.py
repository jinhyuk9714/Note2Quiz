from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient


async def _make_document(client: AsyncClient, title: str = "Test Doc") -> dict[str, Any]:
    resp = await client.post(
        "/api/documents/",
        data={"title": title, "text": "A sufficiently long text for testing purposes. " * 3},
    )
    assert resp.status_code == 201
    return resp.json()  # type: ignore[no-any-return]


class TestShareToggle:
    async def test_enable_sharing(self, client: AsyncClient, db_session: Any) -> None:
        """Enable sharing on a quiz — share_code should be auto-generated."""
        from app.models.quiz import Quiz

        # Create document + quiz directly in DB
        doc = await _make_document(client)
        quiz = Quiz(
            document_id=uuid.UUID(doc["id"]),
            title="Test Quiz",
            item_count=1,
        )
        db_session.add(quiz)
        await db_session.commit()
        await db_session.refresh(quiz)

        # Enable sharing
        resp = await client.post(
            f"/api/quiz/{quiz.id}/share",
            json={"is_shared": True},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_shared"] is True
        assert data["share_code"] is not None
        assert len(data["share_code"]) == 8
        assert data["share_url"] is not None
        assert data["share_code"] in data["share_url"]

    async def test_disable_sharing(self, client: AsyncClient, db_session: Any) -> None:
        """Disable sharing — share_code is preserved but URL is None."""
        from app.models.quiz import Quiz

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Test Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.commit()
        await db_session.refresh(quiz)

        # Enable then disable
        await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": False})
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_shared"] is False
        assert data["share_code"] is not None  # Preserved
        assert data["share_url"] is None  # No URL when disabled

    async def test_get_share_info(self, client: AsyncClient, db_session: Any) -> None:
        from app.models.quiz import Quiz

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Test Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.commit()
        await db_session.refresh(quiz)

        resp = await client.get(f"/api/quiz/{quiz.id}/share")
        assert resp.status_code == 200
        data = resp.json()
        assert data["is_shared"] is False
        assert data["share_code"] is None

    async def test_toggle_share_not_owner_404(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Test Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.commit()
        await db_session.refresh(quiz)

        resp = await second_client.post(
            f"/api/quiz/{quiz.id}/share", json={"is_shared": True}
        )
        assert resp.status_code == 404


class TestShareRegenerate:
    async def test_regenerate_changes_code(
        self, client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Test Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.commit()
        await db_session.refresh(quiz)

        # Enable sharing
        resp1 = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        code1 = resp1.json()["share_code"]

        # Regenerate
        resp2 = await client.post(f"/api/quiz/{quiz.id}/share/regenerate")
        assert resp2.status_code == 200
        code2 = resp2.json()["share_code"]

        assert code2 != code1
        assert resp2.json()["is_shared"] is True


class TestShareAccess:
    async def _shared_quiz(
        self, client: AsyncClient, db_session: Any
    ) -> tuple[str, str]:
        """Helper: create a shared quiz with items, return (quiz_id, share_code)."""
        from app.models.quiz import Quiz, QuizItem, QuizType

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Shared Quiz", item_count=2)
        db_session.add(quiz)
        await db_session.flush()

        for i in range(2):
            item = QuizItem(
                quiz_id=quiz.id,
                source_chunk_id=None,
                quiz_type=QuizType.MCQ,
                question=f"Question {i + 1}?",
                correct_answer="A",
                explanation=f"Because {i + 1}",
                options={"A": "Answer A", "B": "Answer B"},
                concept_tags=["test"],
                difficulty=1,
            )
            db_session.add(item)

        await db_session.commit()
        await db_session.refresh(quiz)

        # Enable sharing
        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        share_code = resp.json()["share_code"]
        return str(quiz.id), share_code

    async def test_access_shared_quiz(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        _, share_code = await self._shared_quiz(client, db_session)

        resp = await second_client.get(f"/api/share/{share_code}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["title"] == "Shared Quiz"
        assert data["item_count"] == 2
        assert data["owner_display_name"] == "Test User"
        assert len(data["items"]) == 2
        # Items should NOT have correct_answer
        assert "correct_answer" not in data["items"][0]

    async def test_access_invalid_code_404(self, client: AsyncClient) -> None:
        resp = await client.get("/api/share/INVALID1")
        assert resp.status_code == 404

    async def test_access_disabled_share_404(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        quiz_id, share_code = await self._shared_quiz(client, db_session)

        # Disable sharing
        await client.post(f"/api/quiz/{quiz_id}/share", json={"is_shared": False})

        resp = await second_client.get(f"/api/share/{share_code}")
        assert resp.status_code == 404


class TestSharedQuizSubmit:
    async def test_submit_shared_quiz(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz, QuizItem, QuizType

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Submit Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.flush()

        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=None,
            quiz_type=QuizType.MCQ,
            question="What is 1+1?",
            correct_answer="A",
            explanation="Basic math",
            options={"A": "2", "B": "3"},
            concept_tags=["math"],
            difficulty=1,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(quiz)
        await db_session.refresh(item)

        # Enable sharing
        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        share_code = resp.json()["share_code"]

        # Second user submits
        submit_resp = await second_client.post(
            f"/api/share/{share_code}/submit",
            json={"answers": [{"quiz_item_id": str(item.id), "user_answer": "A"}]},
        )
        assert submit_resp.status_code == 201
        data = submit_resp.json()
        assert data["score"] == 1
        assert data["total"] == 1
        assert data["results"][0]["is_correct"] is True


class TestSharedQuizStudy:
    async def test_study_without_attempt_403(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz, QuizItem, QuizType

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Study Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.flush()

        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=None,
            quiz_type=QuizType.SHORT_ANSWER,
            question="What is Python?",
            correct_answer="A programming language",
            explanation="Python is a programming language",
            options=None,
            concept_tags=["cs"],
            difficulty=1,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(quiz)

        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        share_code = resp.json()["share_code"]

        # Try study without attempt
        study_resp = await second_client.get(f"/api/share/{share_code}/study")
        assert study_resp.status_code == 403

    async def test_study_after_attempt_success(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz, QuizItem, QuizType

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Study Quiz", item_count=1)
        db_session.add(quiz)
        await db_session.flush()

        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=None,
            quiz_type=QuizType.MCQ,
            question="Test?",
            correct_answer="A",
            explanation="Explanation",
            options={"A": "Yes", "B": "No"},
            concept_tags=["test"],
            difficulty=1,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(quiz)
        await db_session.refresh(item)

        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        share_code = resp.json()["share_code"]

        # Submit first
        await second_client.post(
            f"/api/share/{share_code}/submit",
            json={"answers": [{"quiz_item_id": str(item.id), "user_answer": "A"}]},
        )

        # Now study should work
        study_resp = await second_client.get(f"/api/share/{share_code}/study")
        assert study_resp.status_code == 200
        data = study_resp.json()
        assert data["items"][0]["correct_answer"] == "A"
        assert data["items"][0]["explanation"] == "Explanation"


class TestQuizCopy:
    async def test_copy_shared_quiz(
        self, client: AsyncClient, second_client: AsyncClient, db_session: Any
    ) -> None:
        from app.models.quiz import Quiz, QuizItem, QuizType

        doc = await _make_document(client)
        quiz = Quiz(document_id=uuid.UUID(doc["id"]), title="Copy Quiz", item_count=2)
        db_session.add(quiz)
        await db_session.flush()

        for i in range(2):
            item = QuizItem(
                quiz_id=quiz.id,
                source_chunk_id=None,
                quiz_type=QuizType.MCQ,
                question=f"Q{i + 1}?",
                correct_answer="A",
                explanation=f"E{i + 1}",
                options={"A": "Yes", "B": "No"},
                concept_tags=["copy"],
                difficulty=1,
            )
            db_session.add(item)
        await db_session.commit()
        await db_session.refresh(quiz)

        resp = await client.post(f"/api/quiz/{quiz.id}/share", json={"is_shared": True})
        share_code = resp.json()["share_code"]

        # Second user copies
        copy_resp = await second_client.post(f"/api/share/{share_code}/copy")
        assert copy_resp.status_code == 201
        data = copy_resp.json()
        assert data["title"] == "Copy Quiz"
        assert data["item_count"] == 2

        # Verify the copied quiz is accessible by the second user
        quiz_resp = await second_client.get(f"/api/quiz/{data['quiz_id']}")
        assert quiz_resp.status_code == 200
        assert quiz_resp.json()["title"] == "Copy Quiz"

    async def test_copy_nonexistent_code_404(self, client: AsyncClient) -> None:
        resp = await client.post(f"/api/share/{uuid.uuid4().hex[:8]}/copy")
        assert resp.status_code == 404
