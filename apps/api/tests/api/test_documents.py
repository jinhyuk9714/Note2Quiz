from __future__ import annotations

import uuid

from httpx import AsyncClient


class TestUploadDocument:
    async def test_upload_success(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            json={
                "title": "Test Doc",
                "text": "A sufficiently long text for testing purposes. " * 3,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Doc"
        assert data["chunk_count"] >= 1
        uuid.UUID(data["id"])

    async def test_upload_empty_title_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            json={"title": "", "text": "Some valid text here for testing."},
        )
        assert resp.status_code == 422

    async def test_upload_short_text_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            json={"title": "Title", "text": "short"},
        )
        assert resp.status_code == 422


class TestListDocuments:
    async def test_empty_list(self, client: AsyncClient) -> None:
        resp = await client.get("/api/documents/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_after_upload(self, client: AsyncClient) -> None:
        await client.post(
            "/api/documents/",
            json={"title": "Doc1", "text": "Long enough text for testing purpose here."},
        )
        resp = await client.get("/api/documents/")
        assert resp.status_code == 200
        docs = resp.json()
        assert len(docs) == 1
        assert docs[0]["title"] == "Doc1"


class TestGetDocument:
    async def test_get_existing(self, client: AsyncClient) -> None:
        create_resp = await client.post(
            "/api/documents/",
            json={
                "title": "Detail",
                "text": "This text must be long enough for chunking to work properly.",
            },
        )
        doc_id = create_resp.json()["id"]
        resp = await client.get(f"/api/documents/{doc_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == doc_id
        assert "chunks" in data
        assert len(data["chunks"]) >= 1

    async def test_get_nonexistent_returns_404(self, client: AsyncClient) -> None:
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/api/documents/{fake_id}")
        assert resp.status_code == 404
