from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from tests.integration.conftest import generate_quiz

SIGNUP_PAYLOAD = {
    "email": "flow@example.com",
    "display_name": "Flow User",
    "password": "testpassword123",
}

SIGNUP_PAYLOAD_2 = {
    "email": "other@example.com",
    "display_name": "Other User",
    "password": "otherpassword123",
}


async def _signup_and_auth(anon_client: AsyncClient, payload: dict[str, str]) -> dict[str, str]:
    """Sign up a user and return auth headers."""
    resp = await anon_client.post("/api/auth/signup", json=payload)
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestFullQuizFlow:
    """E2E: signup → upload → generate quiz → submit → wrong notes → review → dashboard."""

    async def test_signup_to_review(self, anon_client: AsyncClient) -> None:
        # 1. Sign up
        headers = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)

        # 2. Upload document
        doc_resp = await anon_client.post(
            "/api/documents/",
            data={
                "title": "Integration Doc",
                "text": "This is long enough text material for integration test quiz generation.",
            },
            headers=headers,
        )
        assert doc_resp.status_code == 201
        doc_id = doc_resp.json()["id"]

        # 3. Generate quiz (mocked LLM)
        quiz = await generate_quiz(anon_client, doc_id, headers=headers)

        # Need auth for subsequent requests
        quiz_id = quiz["id"]
        assert quiz["item_count"] == 1
        item_id = quiz["items"][0]["id"]

        # 4. Submit answer (intentionally wrong to generate wrong note)
        submit_resp = await anon_client.post(
            f"/api/quiz/{quiz_id}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "B"}]},
            headers=headers,
        )
        assert submit_resp.status_code == 201
        submit_data = submit_resp.json()
        assert submit_data["score"] == 0
        assert submit_data["total"] == 1
        assert submit_data["wrong_notes_created"] >= 1

        # 5. Check wrong notes
        notes_resp = await anon_client.get("/api/wrong-notes/", headers=headers)
        assert notes_resp.status_code == 200
        notes_data = notes_resp.json()
        assert notes_data["total"] >= 1
        note = notes_data["notes"][0]
        assert note["is_mastered"] is False

        # 6. Review the wrong note
        review_resp = await anon_client.post(
            f"/api/wrong-notes/{note['id']}/review",
            json={"quality": 5},
            headers=headers,
        )
        assert review_resp.status_code == 200
        reviewed = review_resp.json()
        assert reviewed["consecutive_correct"] == 1

        # 7. Check dashboard
        dashboard_resp = await anon_client.get("/api/dashboard/stats", headers=headers)
        assert dashboard_resp.status_code == 200
        dashboard = dashboard_resp.json()
        assert dashboard["learning_progress"]["total_quizzes_taken"] >= 1
        assert dashboard["learning_progress"]["total_questions_answered"] >= 1

    async def test_correct_answer_no_wrong_note(self, anon_client: AsyncClient) -> None:
        """Submitting a correct answer should NOT create wrong notes."""
        headers = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)

        doc_resp = await anon_client.post(
            "/api/documents/",
            data={
                "title": "Correct Doc",
                "text": "Enough material here for generating quiz items in testing.",
            },
            headers=headers,
        )
        doc_id = doc_resp.json()["id"]
        quiz = await generate_quiz(anon_client, doc_id, headers=headers)

        # Submit correct answer
        item_id = quiz["items"][0]["id"]
        submit_resp = await anon_client.post(
            f"/api/quiz/{quiz['id']}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "A"}]},
            headers=headers,
        )
        assert submit_resp.status_code == 201
        assert submit_resp.json()["score"] == 1
        assert submit_resp.json()["wrong_notes_created"] == 0

    async def test_multiple_attempts_tracked(self, anon_client: AsyncClient) -> None:
        """Multiple submissions should create separate attempts with increasing attempt_number."""
        headers = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)

        doc_resp = await anon_client.post(
            "/api/documents/",
            data={"title": "Multi Attempt", "text": "Material for multi attempt quiz testing."},
            headers=headers,
        )
        doc_id = doc_resp.json()["id"]
        quiz = await generate_quiz(anon_client, doc_id, headers=headers)
        quiz_id = quiz["id"]
        item_id = quiz["items"][0]["id"]

        # Attempt 1
        r1 = await anon_client.post(
            f"/api/quiz/{quiz_id}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "B"}]},
            headers=headers,
        )
        assert r1.status_code == 201
        assert r1.json()["attempt_number"] == 1

        # Attempt 2
        r2 = await anon_client.post(
            f"/api/quiz/{quiz_id}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "A"}]},
            headers=headers,
        )
        assert r2.status_code == 201
        assert r2.json()["attempt_number"] == 2

        # Verify attempts list
        attempts_resp = await anon_client.get(f"/api/quiz/{quiz_id}/attempts", headers=headers)
        assert attempts_resp.status_code == 200
        assert len(attempts_resp.json()) == 2


class TestRefreshTokenFlow:
    """E2E: login → token refresh → use refreshed token for API call."""

    async def test_full_refresh_cycle(self, anon_client: AsyncClient) -> None:
        # Sign up
        signup_resp = await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        assert signup_resp.status_code == 201
        tokens = signup_resp.json()
        assert "refresh_token" in tokens

        # Refresh
        refresh_resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert refresh_resp.status_code == 200
        new_tokens = refresh_resp.json()
        assert new_tokens["refresh_token"] != tokens["refresh_token"]

        # Use new access token
        me_resp = await anon_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == SIGNUP_PAYLOAD["email"]

        # Old refresh token should be invalid
        old_refresh_resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert old_refresh_resp.status_code == 401


class TestPasswordResetFlow:
    """E2E: signup → forgot-password → get token from DB → reset → login with new password."""

    async def test_full_password_reset(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        # Sign up
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)

        # Request reset
        forgot_resp = await anon_client.post(
            "/api/auth/forgot-password",
            json={"email": SIGNUP_PAYLOAD["email"]},
        )
        assert forgot_resp.status_code == 204

        # Get token from DB
        import sqlalchemy

        from app.models.user import User

        stmt = sqlalchemy.select(User).where(User.email == SIGNUP_PAYLOAD["email"])
        result = await db_session.execute(stmt)
        user = result.scalar_one()
        assert user.password_reset_token is not None
        token = user.password_reset_token

        # Reset password
        reset_resp = await anon_client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "brandnewpassword123"},
        )
        assert reset_resp.status_code == 204

        # Login with new password
        login_resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": "brandnewpassword123"},
        )
        assert login_resp.status_code == 200

        # Old password should fail
        old_login_resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
        )
        assert old_login_resp.status_code == 401


class TestCrossUserIsolation:
    """Verify that users cannot access each other's data."""

    async def test_user_cannot_access_other_quiz(self, anon_client: AsyncClient) -> None:
        # User A signs up and creates a quiz
        headers_a = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)
        doc_resp = await anon_client.post(
            "/api/documents/",
            data={"title": "User A Doc", "text": "Material for user A quiz testing isolation."},
            headers=headers_a,
        )
        doc_id = doc_resp.json()["id"]
        quiz = await generate_quiz(anon_client, doc_id, headers=headers_a)
        quiz_id = quiz["id"]

        # User B signs up
        headers_b = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD_2)

        # User B tries to access User A's quiz
        resp = await anon_client.get(f"/api/quiz/{quiz_id}", headers=headers_b)
        assert resp.status_code == 404

    async def test_user_cannot_see_other_wrong_notes(self, anon_client: AsyncClient) -> None:
        # User A signs up, creates quiz, submits wrong answer
        headers_a = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)
        doc_resp = await anon_client.post(
            "/api/documents/",
            data={"title": "Notes Doc", "text": "Material for wrong notes isolation testing."},
            headers=headers_a,
        )
        doc_id = doc_resp.json()["id"]
        quiz = await generate_quiz(anon_client, doc_id, headers=headers_a)
        item_id = quiz["items"][0]["id"]

        await anon_client.post(
            f"/api/quiz/{quiz['id']}/submit",
            json={"answers": [{"quiz_item_id": item_id, "user_answer": "B"}]},
            headers=headers_a,
        )

        # Verify User A has wrong notes
        notes_a = await anon_client.get("/api/wrong-notes/", headers=headers_a)
        assert notes_a.json()["total"] >= 1

        # User B signs up
        headers_b = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD_2)

        # User B should see no wrong notes
        notes_b = await anon_client.get("/api/wrong-notes/", headers=headers_b)
        assert notes_b.json()["total"] == 0

    async def test_user_cannot_delete_other_document(self, anon_client: AsyncClient) -> None:
        # User A creates a document
        headers_a = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD)
        doc_resp = await anon_client.post(
            "/api/documents/",
            data={"title": "Private Doc", "text": "Private document for deletion isolation test."},
            headers=headers_a,
        )
        doc_id = doc_resp.json()["id"]

        # User B cannot delete it
        headers_b = await _signup_and_auth(anon_client, SIGNUP_PAYLOAD_2)
        del_resp = await anon_client.delete(f"/api/documents/{doc_id}", headers=headers_b)
        assert del_resp.status_code == 404

        # User A can still see it
        get_resp = await anon_client.get(f"/api/documents/{doc_id}", headers=headers_a)
        assert get_resp.status_code == 200
