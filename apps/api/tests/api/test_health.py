from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from app.main import app


class TestHealthCheck:
    async def test_health_returns_ok(self) -> None:
        transport = ASGITransport(app=app)  # type: ignore[arg-type]
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
