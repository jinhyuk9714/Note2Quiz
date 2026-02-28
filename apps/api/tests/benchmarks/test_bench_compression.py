"""GZip compression benchmark: verify middleware is active and estimate savings."""

from __future__ import annotations

import gzip
import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_session_factory
from app.main import app
from tests.benchmarks.seed_factory import SeedResult


@pytest.mark.benchmark
class TestCompressionBenchmark:
    """Verify GZip middleware is active and estimate compression savings."""

    async def test_gzip_enabled(
        self, db_session: AsyncSession, large_dataset: SeedResult
    ) -> None:
        """Verify the GZip middleware sets content-encoding: gzip for large responses."""
        from app.services.auth_service import create_access_token

        token = create_access_token(str(large_dataset.user_id))
        headers = {"Authorization": f"Bearer {token}"}

        async def override_get_db():  # type: ignore[no-untyped-def]
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_session_factory] = lambda: None  # type: ignore[assignment]

        transport = ASGITransport(app=app)  # type: ignore[arg-type]
        endpoints = [
            "/api/documents/",
            "/api/quiz/",
        ]

        results: list[dict[str, object]] = []

        async with AsyncClient(transport=transport, base_url="http://test", headers=headers) as ac:
            for ep in endpoints:
                resp = await ac.get(ep, headers={"Accept-Encoding": "gzip"})
                assert resp.status_code == 200

                is_compressed = resp.headers.get("content-encoding") == "gzip"

                # httpx transparently decompresses, so measure by re-encoding
                json_body = resp.json()
                raw_bytes = json.dumps(json_body, ensure_ascii=False).encode("utf-8")
                raw_size = len(raw_bytes)
                compressed_bytes = gzip.compress(raw_bytes)
                compressed_size = len(compressed_bytes)

                ratio = (1 - compressed_size / raw_size) * 100 if raw_size > 0 else 0

                results.append(
                    {
                        "endpoint": ep,
                        "raw_bytes": raw_size,
                        "gzip_bytes": compressed_size,
                        "compressed": is_compressed,
                        "reduction_pct": round(ratio, 1),
                    }
                )

        app.dependency_overrides.clear()

        # Print results
        print("\n" + "=" * 70)
        print("  GZip Compression Results")
        print("=" * 70)
        print(f"  {'Endpoint':<25} {'Raw':>10} {'GZip':>10} {'Reduction':>12} {'Active'}")
        print(f"  {'-' * 25} {'-' * 10} {'-' * 10} {'-' * 12} {'-' * 10}")
        for r in results:
            print(
                f"  {str(r['endpoint']):<25} "
                f"{r['raw_bytes']:>8} B "
                f"{r['gzip_bytes']:>8} B "
                f"{r['reduction_pct']:>10}% "
                f"{'yes' if r['compressed'] else 'no':>10}"
            )
        print("=" * 70)

        # Assertions
        for r in results:
            raw = int(str(r["raw_bytes"]))
            if raw > 1000:
                assert r["compressed"], f"{r['endpoint']} should have gzip encoding"
                assert float(str(r["reduction_pct"])) > 30, (
                    f"{r['endpoint']} should have >30% compression ratio"
                )
