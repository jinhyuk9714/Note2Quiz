from __future__ import annotations

import uuid
from io import BytesIO

import fitz  # pyright: ignore[reportMissingTypeStubs]
from httpx import AsyncClient


def _make_test_pdf(text: str, num_pages: int = 1) -> bytes:
    """Create a minimal PDF with the given text for testing."""
    doc: fitz.Document = fitz.open()  # pyright: ignore[reportUnknownMemberType]
    for _ in range(num_pages):
        page = doc.new_page()
        page.insert_text((50, 50), text)  # pyright: ignore[reportUnknownMemberType]
    pdf_bytes: bytes = doc.tobytes()  # pyright: ignore[reportUnknownMemberType]
    doc.close()
    return pdf_bytes


class TestUploadDocument:
    async def test_upload_text_success(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={
                "title": "Test Doc",
                "text": "A sufficiently long text for testing purposes. " * 3,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Test Doc"
        assert data["source_type"] == "text"
        assert data["chunk_count"] >= 1
        uuid.UUID(data["id"])

    async def test_upload_pdf_success(self, client: AsyncClient) -> None:
        pdf_bytes = _make_test_pdf(
            "This is a test PDF document with enough text for extraction and chunking."
        )
        resp = await client.post(
            "/api/documents/",
            data={"title": "PDF Doc"},
            files={"file": ("test.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["source_type"] == "pdf"
        assert data["chunk_count"] >= 1

    async def test_upload_both_text_and_file_returns_422(self, client: AsyncClient) -> None:
        pdf_bytes = _make_test_pdf("Some text.")
        resp = await client.post(
            "/api/documents/",
            data={"title": "Both", "text": "Some text provided alongside a file."},
            files={"file": ("test.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
        assert resp.status_code == 422

    async def test_upload_neither_text_nor_file_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={"title": "Neither"},
        )
        assert resp.status_code == 422

    async def test_upload_non_pdf_file_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={"title": "Bad File"},
            files={"file": ("test.txt", BytesIO(b"hello"), "text/plain")},
        )
        assert resp.status_code == 422

    async def test_upload_empty_title_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={"title": "", "text": "Some valid text here for testing."},
        )
        assert resp.status_code == 422

    async def test_upload_short_text_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={"title": "Title", "text": "short"},
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
            data={"title": "Doc1", "text": "Long enough text for testing purpose here."},
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
            data={
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


class TestDeleteDocument:
    async def test_delete_existing_returns_204(self, client: AsyncClient) -> None:
        create_resp = await client.post(
            "/api/documents/",
            data={
                "title": "ToDelete",
                "text": "Long enough text for the deletion test here.",
            },
        )
        doc_id = create_resp.json()["id"]

        resp = await client.delete(f"/api/documents/{doc_id}")
        assert resp.status_code == 204

    async def test_delete_nonexistent_returns_404(self, client: AsyncClient) -> None:
        resp = await client.delete(f"/api/documents/{uuid.uuid4()}")
        assert resp.status_code == 404

    async def test_delete_then_get_returns_404(self, client: AsyncClient) -> None:
        create_resp = await client.post(
            "/api/documents/",
            data={
                "title": "CascadeTest",
                "text": "Long enough text for cascade test here really.",
            },
        )
        doc_id = create_resp.json()["id"]

        await client.delete(f"/api/documents/{doc_id}")

        get_resp = await client.get(f"/api/documents/{doc_id}")
        assert get_resp.status_code == 404
