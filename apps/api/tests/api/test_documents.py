from __future__ import annotations

import json
import uuid
from io import BytesIO
from unittest.mock import AsyncMock, MagicMock, patch

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

    async def test_upload_image_jpeg_success(self, client: AsyncClient) -> None:
        from anthropic.types import TextBlock

        mock_block = MagicMock(spec=TextBlock)
        mock_block.text = "Extracted lecture notes text here with enough content for chunking."

        mock_response = MagicMock()
        mock_response.content = [mock_block]
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch(
            "app.services.ocr_service.create_llm_client",
            return_value=mock_client,
        ):
            resp = await client.post(
                "/api/documents/",
                data={"title": "Image Doc"},
                files={"file": ("slide.jpg", BytesIO(b"x" * 1000), "image/jpeg")},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["source_type"] == "image"
        assert data["chunk_count"] >= 1

    async def test_upload_image_png_success(self, client: AsyncClient) -> None:
        from anthropic.types import TextBlock

        mock_block = MagicMock(spec=TextBlock)
        mock_block.text = "PNG image text content extracted successfully for testing."

        mock_response = MagicMock()
        mock_response.content = [mock_block]
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch(
            "app.services.ocr_service.create_llm_client",
            return_value=mock_client,
        ):
            resp = await client.post(
                "/api/documents/",
                data={"title": "PNG Doc"},
                files={"file": ("slide.png", BytesIO(b"x" * 1000), "image/png")},
            )
        assert resp.status_code == 201
        assert resp.json()["source_type"] == "image"

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
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_list_after_upload(self, client: AsyncClient) -> None:
        await client.post(
            "/api/documents/",
            data={"title": "Doc1", "text": "Long enough text for testing purpose here."},
        )
        resp = await client.get("/api/documents/")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["title"] == "Doc1"
        assert data["total"] == 1


class TestDocumentSearchAndPagination:
    async def _upload(self, client: AsyncClient, title: str) -> dict[str, str]:
        resp = await client.post(
            "/api/documents/",
            data={"title": title, "text": "Long enough text for testing purpose here."},
        )
        return resp.json()  # type: ignore[no-any-return]

    async def test_search_by_title(self, client: AsyncClient) -> None:
        await self._upload(client, "Operating Systems Lecture 1")
        await self._upload(client, "Data Structures Lecture 2")
        await self._upload(client, "Operating Systems Lecture 3")

        resp = await client.get("/api/documents/?search=Operating")
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    async def test_filter_by_source_type(self, client: AsyncClient) -> None:
        await self._upload(client, "Text Doc")
        # All test uploads are "text" source_type
        resp = await client.get("/api/documents/?source_type=pdf")
        assert resp.json()["total"] == 0

        resp = await client.get("/api/documents/?source_type=text")
        assert resp.json()["total"] == 1

    async def test_invalid_folder_id_returns_422(self, client: AsyncClient) -> None:
        await self._upload(client, "Folder Filter Target")

        resp = await client.get("/api/documents/?folder_id=invalid-uuid")
        assert resp.status_code == 422

    async def test_pagination(self, client: AsyncClient) -> None:
        for i in range(5):
            await self._upload(client, f"Doc {i}")

        resp = await client.get("/api/documents/?limit=2&offset=0")
        data = resp.json()
        assert data["total"] == 5
        assert len(data["items"]) == 2
        assert data["limit"] == 2
        assert data["offset"] == 0

        resp2 = await client.get("/api/documents/?limit=2&offset=4")
        data2 = resp2.json()
        assert len(data2["items"]) == 1

    async def test_sort_by_title_asc(self, client: AsyncClient) -> None:
        await self._upload(client, "Charlie")
        await self._upload(client, "Alpha")
        await self._upload(client, "Bravo")

        resp = await client.get("/api/documents/?sort_by=title&order=asc")
        titles = [d["title"] for d in resp.json()["items"]]
        assert titles == ["Alpha", "Bravo", "Charlie"]

    async def test_search_case_insensitive(self, client: AsyncClient) -> None:
        await self._upload(client, "Machine Learning Notes")

        resp = await client.get("/api/documents/?search=machine")
        assert resp.json()["total"] == 1


class TestDocumentQuizCount:
    async def test_quiz_count_initially_zero(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/documents/",
            data={"title": "No Quiz Doc", "text": "Long enough text for testing purpose here."},
        )
        assert resp.status_code == 201
        assert resp.json()["quiz_count"] == 0

    async def test_quiz_count_after_quiz_generation(self, client: AsyncClient) -> None:
        doc_resp = await client.post(
            "/api/documents/",
            data={
                "title": "Quiz Count Doc",
                "text": "Long enough text for quiz generation testing.",
            },
        )
        doc_id = doc_resp.json()["id"]

        mock_block = MagicMock()
        mock_block.text = json.dumps(
            [
                {
                    "quiz_type": "mcq",
                    "question": "Q?",
                    "correct_answer": "A",
                    "explanation": "E",
                    "options": {"A": "1", "B": "2", "C": "3", "D": "4"},
                    "concept_tags": ["test"],
                    "difficulty": 1,
                }
            ]
        )
        mock_response = MagicMock()
        mock_response.content = [mock_block]
        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with (
            patch("app.services.quiz_generation.create_llm_client", return_value=mock_client),
            patch(
                "app.services.quiz_generation.isinstance",
                side_effect=lambda obj, cls: True,  # type: ignore[arg-type]
            ),
        ):
            await client.post(
                "/api/quiz/generate",
                json={"document_id": doc_id, "n_questions": 1, "quiz_types": ["mcq"]},
            )

        # List documents should show quiz_count=1
        list_resp = await client.get("/api/documents/")
        items = list_resp.json()["items"]
        target = next(d for d in items if d["id"] == doc_id)
        assert target["quiz_count"] == 1

        # Get document detail should also show quiz_count=1
        detail_resp = await client.get(f"/api/documents/{doc_id}")
        assert detail_resp.json()["quiz_count"] == 1


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


class TestUpdateDocument:
    async def _create_doc(self, client: AsyncClient) -> str:
        resp = await client.post(
            "/api/documents/",
            data={"title": "Original Title", "text": "Long enough text for testing purpose here."},
        )
        return resp.json()["id"]  # type: ignore[no-any-return]

    async def test_rename_success(self, client: AsyncClient) -> None:
        doc_id = await self._create_doc(client)
        resp = await client.patch(f"/api/documents/{doc_id}", json={"title": "New Title"})
        assert resp.status_code == 200
        assert resp.json()["title"] == "New Title"

    async def test_rename_reflects_in_get(self, client: AsyncClient) -> None:
        doc_id = await self._create_doc(client)
        await client.patch(f"/api/documents/{doc_id}", json={"title": "Updated"})
        get_resp = await client.get(f"/api/documents/{doc_id}")
        assert get_resp.json()["title"] == "Updated"

    async def test_rename_empty_title_returns_422(self, client: AsyncClient) -> None:
        doc_id = await self._create_doc(client)
        resp = await client.patch(f"/api/documents/{doc_id}", json={"title": ""})
        assert resp.status_code == 422

    async def test_rename_too_long_title_returns_422(self, client: AsyncClient) -> None:
        doc_id = await self._create_doc(client)
        resp = await client.patch(f"/api/documents/{doc_id}", json={"title": "x" * 501})
        assert resp.status_code == 422

    async def test_rename_nonexistent_returns_404(self, client: AsyncClient) -> None:
        resp = await client.patch(f"/api/documents/{uuid.uuid4()}", json={"title": "New"})
        assert resp.status_code == 404

    async def test_rename_other_users_doc_returns_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        doc_id = await self._create_doc(client)
        resp = await second_client.patch(f"/api/documents/{doc_id}", json={"title": "Hacked"})
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
