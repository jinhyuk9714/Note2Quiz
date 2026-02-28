from __future__ import annotations

import json
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.main import app


@pytest.fixture
async def anon_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client without auth headers — for testing signup/login."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


SIGNUP_PAYLOAD = {
    "email": "new@example.com",
    "display_name": "New User",
    "password": "strongpassword123",
}


class TestSignup:
    async def test_signup_success(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    async def test_duplicate_email_returns_409(self, anon_client: AsyncClient) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        resp = await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp.status_code == 409

    async def test_short_password_returns_422(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/signup",
            json={**SIGNUP_PAYLOAD, "password": "short"},
        )
        assert resp.status_code == 422


class TestLogin:
    async def test_login_success(self, anon_client: AsyncClient) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_wrong_password_returns_401(self, anon_client: AsyncClient) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": "wrongpassword123"},
        )
        assert resp.status_code == 401

    async def test_nonexistent_email_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "whatever123"},
        )
        assert resp.status_code == 401


class TestGetMe:
    async def test_me_success(self, anon_client: AsyncClient) -> None:
        signup_resp = await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        token = signup_resp.json()["access_token"]

        resp = await anon_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == SIGNUP_PAYLOAD["email"]
        assert data["display_name"] == SIGNUP_PAYLOAD["display_name"]

    async def test_me_without_token_is_rejected(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.get("/api/auth/me")
        assert resp.status_code in (401, 403)

    async def test_me_invalid_token_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401


class TestLoginValidation:
    async def test_login_empty_password_returns_422(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": "a@b.com", "password": ""},
        )
        assert resp.status_code == 422

    async def test_login_oversized_email_returns_422(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": "a" * 300 + "@example.com", "password": "test1234"},
        )
        assert resp.status_code == 422


async def _signup_and_get_headers(client: AsyncClient) -> dict[str, str]:
    """Helper: signup and return auth headers."""
    resp = await client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _signup_and_get_tokens(client: AsyncClient) -> dict[str, str]:
    """Helper: signup and return full token response."""
    resp = await client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
    return resp.json()  # type: ignore[no-any-return]


class TestUpdateProfile:
    async def test_update_display_name(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.patch(
            "/api/auth/me",
            json={"display_name": "Updated Name"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["display_name"] == "Updated Name"

    async def test_update_empty_name_returns_422(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.patch(
            "/api/auth/me",
            json={"display_name": ""},
            headers=headers,
        )
        assert resp.status_code == 422

    async def test_update_without_auth_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.patch("/api/auth/me", json={"display_name": "X"})
        assert resp.status_code in (401, 403)


class TestChangePassword:
    async def test_change_password_success(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.put(
            "/api/auth/me/password",
            json={
                "current_password": SIGNUP_PAYLOAD["password"],
                "new_password": "newpassword456",
            },
            headers=headers,
        )
        assert resp.status_code == 204

        # Verify login with new password works
        login_resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": "newpassword456"},
        )
        assert login_resp.status_code == 200

    async def test_wrong_current_password_returns_400(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.put(
            "/api/auth/me/password",
            json={"current_password": "wrongpassword", "new_password": "newpassword456"},
            headers=headers,
        )
        assert resp.status_code == 400

    async def test_short_new_password_returns_422(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.put(
            "/api/auth/me/password",
            json={
                "current_password": SIGNUP_PAYLOAD["password"],
                "new_password": "short",
            },
            headers=headers,
        )
        assert resp.status_code == 422


class TestDeleteAccount:
    async def test_delete_account_success(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.request(
            "DELETE",
            "/api/auth/me",
            headers={**headers, "Content-Type": "application/json"},
            content=json.dumps({"password": SIGNUP_PAYLOAD["password"]}),
        )
        assert resp.status_code == 204

        # Verify user no longer exists
        me_resp = await anon_client.get("/api/auth/me", headers=headers)
        assert me_resp.status_code == 401

    async def test_delete_wrong_password_returns_400(self, anon_client: AsyncClient) -> None:
        headers = await _signup_and_get_headers(anon_client)
        resp = await anon_client.request(
            "DELETE",
            "/api/auth/me",
            headers={**headers, "Content-Type": "application/json"},
            content=json.dumps({"password": "wrongpassword"}),
        )
        assert resp.status_code == 400

    async def test_delete_without_auth_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.request(
            "DELETE",
            "/api/auth/me",
            headers={"Content-Type": "application/json"},
            content=json.dumps({"password": "whatever"}),
        )
        assert resp.status_code in (401, 403)


class TestRefreshToken:
    async def test_signup_returns_refresh_token(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        assert resp.status_code == 201
        data = resp.json()
        assert "refresh_token" in data
        assert len(data["refresh_token"]) > 0

    async def test_login_returns_refresh_token(self, anon_client: AsyncClient) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": SIGNUP_PAYLOAD["password"]},
        )
        assert resp.status_code == 200
        assert "refresh_token" in resp.json()

    async def test_refresh_success(self, anon_client: AsyncClient) -> None:
        tokens = await _signup_and_get_tokens(anon_client)
        resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert resp.status_code == 200
        new_tokens = resp.json()
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        # New refresh token should differ (rotation)
        assert new_tokens["refresh_token"] != tokens["refresh_token"]

    async def test_refresh_with_invalid_token_returns_401(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": "invalid-token-value"},
        )
        assert resp.status_code == 401

    async def test_old_refresh_token_invalid_after_rotation(self, anon_client: AsyncClient) -> None:
        tokens = await _signup_and_get_tokens(anon_client)
        old_refresh = tokens["refresh_token"]

        # Rotate once
        await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": old_refresh},
        )

        # Old token should now be invalid
        resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert resp.status_code == 401

    async def test_refreshed_access_token_works(self, anon_client: AsyncClient) -> None:
        tokens = await _signup_and_get_tokens(anon_client)
        resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        new_tokens = resp.json()

        me_resp = await anon_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == SIGNUP_PAYLOAD["email"]


class TestLogout:
    async def test_logout_invalidates_refresh_token(self, anon_client: AsyncClient) -> None:
        tokens = await _signup_and_get_tokens(anon_client)
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        resp = await anon_client.post("/api/auth/logout", headers=headers)
        assert resp.status_code == 204

        # Refresh should now fail
        refresh_resp = await anon_client.post(
            "/api/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
        assert refresh_resp.status_code == 401


class TestForgotPassword:
    async def test_forgot_password_existing_email(self, anon_client: AsyncClient) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        resp = await anon_client.post(
            "/api/auth/forgot-password",
            json={"email": SIGNUP_PAYLOAD["email"]},
        )
        # Always returns 204 to prevent email enumeration
        assert resp.status_code == 204

    async def test_forgot_password_nonexistent_email(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/forgot-password",
            json={"email": "nobody@example.com"},
        )
        # Still returns 204
        assert resp.status_code == 204


class TestResetPassword:
    async def test_reset_password_success(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        await anon_client.post(
            "/api/auth/forgot-password",
            json={"email": SIGNUP_PAYLOAD["email"]},
        )

        # Get the token from DB directly
        from app.models.user import User

        stmt = __import__("sqlalchemy").select(User).where(User.email == SIGNUP_PAYLOAD["email"])
        result = await db_session.execute(stmt)
        user = result.scalar_one()
        assert user.password_reset_token is not None

        # Reset the password
        resp = await anon_client.post(
            "/api/auth/reset-password",
            json={"token": user.password_reset_token, "new_password": "brandnewpass123"},
        )
        assert resp.status_code == 204

        # Login with new password
        login_resp = await anon_client.post(
            "/api/auth/login",
            json={"email": SIGNUP_PAYLOAD["email"], "password": "brandnewpass123"},
        )
        assert login_resp.status_code == 200

    async def test_reset_password_invalid_token(self, anon_client: AsyncClient) -> None:
        resp = await anon_client.post(
            "/api/auth/reset-password",
            json={"token": "invalid-token", "new_password": "newpassword123"},
        )
        assert resp.status_code == 400

    async def test_reset_token_single_use(
        self, anon_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        await anon_client.post("/api/auth/signup", json=SIGNUP_PAYLOAD)
        await anon_client.post(
            "/api/auth/forgot-password",
            json={"email": SIGNUP_PAYLOAD["email"]},
        )

        from app.models.user import User

        stmt = __import__("sqlalchemy").select(User).where(User.email == SIGNUP_PAYLOAD["email"])
        result = await db_session.execute(stmt)
        user = result.scalar_one()
        token = user.password_reset_token

        # First use succeeds
        resp = await anon_client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "firstnewpass123"},
        )
        assert resp.status_code == 204

        # Second use fails (token consumed)
        resp2 = await anon_client.post(
            "/api/auth/reset-password",
            json={"token": token, "new_password": "secondnewpass123"},
        )
        assert resp2.status_code == 400
