from __future__ import annotations

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
