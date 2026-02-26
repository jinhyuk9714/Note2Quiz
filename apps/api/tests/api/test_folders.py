from __future__ import annotations

import uuid
from typing import Any

from httpx import AsyncClient


async def _make_folder(
    client: AsyncClient, name: str = "Test Folder", **kwargs: str | None
) -> dict[str, Any]:
    payload: dict[str, str | None] = {"name": name, **kwargs}
    resp = await client.post("/api/folders/", json=payload)
    assert resp.status_code == 201
    return resp.json()  # type: ignore[no-any-return]


async def _make_document(client: AsyncClient, title: str = "Test Doc") -> dict[str, Any]:
    resp = await client.post(
        "/api/documents/",
        data={"title": title, "text": "A sufficiently long text for testing purposes. " * 3},
    )
    assert resp.status_code == 201
    return resp.json()  # type: ignore[no-any-return]


class TestCreateFolder:
    async def test_create_folder_success(self, client: AsyncClient) -> None:
        data = await _make_folder(client, "수학")
        assert data["name"] == "수학"
        assert data["document_count"] == 0
        assert data["color"] is None
        assert data["emoji"] is None
        uuid.UUID(data["id"])

    async def test_create_folder_with_color_emoji(self, client: AsyncClient) -> None:
        data = await _make_folder(client, "영어", color="#3B82F6", emoji="📚")
        assert data["name"] == "영어"
        assert data["color"] == "#3B82F6"
        assert data["emoji"] == "📚"


class TestListFolders:
    async def test_list_folders_empty(self, client: AsyncClient) -> None:
        resp = await client.get("/api/folders/")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_folders_with_counts(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "과학")
        folder_id = folder["id"]

        # Create a document and move it to the folder
        doc = await _make_document(client)
        move_resp = await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": folder_id},
        )
        assert move_resp.status_code == 200

        resp = await client.get("/api/folders/")
        assert resp.status_code == 200
        folders = resp.json()
        assert len(folders) == 1
        assert folders[0]["name"] == "과학"
        assert folders[0]["document_count"] == 1


class TestUpdateFolder:
    async def test_update_folder_name(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Old Name")
        resp = await client.patch(
            f"/api/folders/{folder['id']}",
            json={"name": "New Name"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    async def test_update_folder_color(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Folder")
        resp = await client.patch(
            f"/api/folders/{folder['id']}",
            json={"color": "#EF4444"},
        )
        assert resp.status_code == 200
        assert resp.json()["color"] == "#EF4444"
        assert resp.json()["name"] == "Folder"  # unchanged


class TestDeleteFolder:
    async def test_delete_folder_nullifies_documents(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "ToDelete")
        doc = await _make_document(client)

        # Move doc to folder
        await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": folder["id"]},
        )

        # Verify doc is in folder
        doc_resp = await client.get(f"/api/documents/{doc['id']}")
        assert doc_resp.json()["folder_id"] == folder["id"]

        # Delete folder
        del_resp = await client.delete(f"/api/folders/{folder['id']}")
        assert del_resp.status_code == 204

        # Document still exists, folder_id is null
        doc_resp2 = await client.get(f"/api/documents/{doc['id']}")
        assert doc_resp2.status_code == 200
        assert doc_resp2.json()["folder_id"] is None

    async def test_delete_folder_other_user_404(
        self, client: AsyncClient, second_client: AsyncClient
    ) -> None:
        folder = await _make_folder(client, "Private")
        resp = await second_client.delete(f"/api/folders/{folder['id']}")
        assert resp.status_code == 404


class TestMoveDocument:
    async def test_move_to_folder_success(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Target")
        doc = await _make_document(client)

        resp = await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": folder["id"]},
        )
        assert resp.status_code == 200
        assert resp.json()["folder_id"] == folder["id"]
        assert resp.json()["folder_name"] == "Target"

    async def test_move_to_null(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Folder")
        doc = await _make_document(client)

        # Move to folder first
        await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": folder["id"]},
        )

        # Move to uncategorized
        resp = await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": None},
        )
        assert resp.status_code == 200
        assert resp.json()["folder_id"] is None
        assert resp.json()["folder_name"] is None

    async def test_move_to_nonexistent_folder_404(self, client: AsyncClient) -> None:
        doc = await _make_document(client)
        resp = await client.patch(
            f"/api/documents/{doc['id']}/folder",
            json={"folder_id": str(uuid.uuid4())},
        )
        assert resp.status_code == 404


class TestDocumentFolderFilter:
    async def test_list_filter_by_folder(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Filtered")
        doc1 = await _make_document(client, "In Folder")
        await _make_document(client, "No Folder")

        await client.patch(
            f"/api/documents/{doc1['id']}/folder",
            json={"folder_id": folder["id"]},
        )

        resp = await client.get(f"/api/documents/?folder_id={folder['id']}")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["title"] == "In Folder"

    async def test_list_filter_uncategorized(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Cat")
        doc1 = await _make_document(client, "Categorized")
        await _make_document(client, "Uncategorized")

        await client.patch(
            f"/api/documents/{doc1['id']}/folder",
            json={"folder_id": folder["id"]},
        )

        resp = await client.get("/api/documents/?folder_id=none")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["title"] == "Uncategorized"

    async def test_upload_with_folder(self, client: AsyncClient) -> None:
        folder = await _make_folder(client, "Upload Target")
        resp = await client.post(
            "/api/documents/",
            data={
                "title": "Doc With Folder",
                "text": "A sufficiently long text for testing purposes. " * 3,
                "folder_id": folder["id"],
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["folder_id"] == folder["id"]
        assert data["folder_name"] == "Upload Target"
