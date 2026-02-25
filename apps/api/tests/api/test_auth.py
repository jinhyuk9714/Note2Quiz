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
