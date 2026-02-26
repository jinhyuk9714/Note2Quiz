from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import func, select

from app.core.deps import CurrentUserID, DBSession
from app.models.document import Document
from app.models.folder import Folder
from app.schemas.folder import (
    FolderCreateRequest,
    FolderResponse,
    FolderUpdateRequest,
)

router = APIRouter(prefix="/folders", tags=["folders"])


@router.post("/", response_model=FolderResponse, status_code=201)
async def create_folder(
    payload: FolderCreateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> FolderResponse:
    folder = Folder(
        owner_id=user_id,
        name=payload.name,
        color=payload.color,
        emoji=payload.emoji,
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        color=folder.color,
        emoji=folder.emoji,
        document_count=0,
        created_at=folder.created_at,
    )


@router.get("/", response_model=list[FolderResponse])
async def list_folders(
    db: DBSession,
    user_id: CurrentUserID,
) -> list[FolderResponse]:
    stmt = (
        select(
            Folder,
            func.count(Document.id).label("doc_count"),
        )
        .outerjoin(Document, Document.folder_id == Folder.id)
        .where(Folder.owner_id == user_id)
        .group_by(Folder.id)
        .order_by(Folder.name.asc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        FolderResponse(
            id=folder.id,
            name=folder.name,
            color=folder.color,
            emoji=folder.emoji,
            document_count=int(doc_count),
            created_at=folder.created_at,
        )
        for folder, doc_count in rows
    ]


@router.patch("/{folder_id}", response_model=FolderResponse)
async def update_folder(
    folder_id: uuid.UUID,
    payload: FolderUpdateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> FolderResponse:
    stmt = select(Folder).where(Folder.id == folder_id, Folder.owner_id == user_id)
    result = await db.execute(stmt)
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(folder, field, value)

    await db.commit()
    await db.refresh(folder)

    # Get document count
    count_stmt = select(func.count(Document.id)).where(Document.folder_id == folder.id)
    doc_count = (await db.execute(count_stmt)).scalar_one()

    return FolderResponse(
        id=folder.id,
        name=folder.name,
        color=folder.color,
        emoji=folder.emoji,
        document_count=int(doc_count),
        created_at=folder.created_at,
    )


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    stmt = select(Folder).where(Folder.id == folder_id, Folder.owner_id == user_id)
    result = await db.execute(stmt)
    folder = result.scalar_one_or_none()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    await db.delete(folder)
    await db.commit()
    return Response(status_code=204)
