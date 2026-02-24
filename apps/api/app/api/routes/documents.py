from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DBSession
from app.models.document import Document
from app.schemas.document import (
    ChunkResponse,
    DocumentDetailResponse,
    DocumentResponse,
    DocumentUploadRequest,
)
from app.services.document_service import create_document_with_chunks

router = APIRouter(prefix="/documents", tags=["documents"])

# Temporary: hardcoded test user until auth is implemented
TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(
    payload: DocumentUploadRequest,
    db: DBSession,
) -> DocumentResponse:
    doc = await create_document_with_chunks(
        db=db,
        owner_id=TEST_USER_ID,
        title=payload.title,
        raw_text=payload.text,
    )
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
    )


@router.get("/", response_model=list[DocumentResponse])
async def list_documents(db: DBSession) -> list[DocumentResponse]:
    stmt = (
        select(Document)
        .where(Document.owner_id == TEST_USER_ID)
        .order_by(Document.created_at.desc())
    )
    result = await db.execute(stmt)
    docs = list(result.scalars().all())
    return [
        DocumentResponse(
            id=d.id,
            title=d.title,
            source_type=d.source_type,
            char_count=d.char_count,
            chunk_count=d.chunk_count,
            created_at=d.created_at,
        )
        for d in docs
    ]


@router.get("/{document_id}", response_model=DocumentDetailResponse)
async def get_document(
    document_id: uuid.UUID,
    db: DBSession,
) -> DocumentDetailResponse:
    stmt = (
        select(Document)
        .where(Document.id == document_id, Document.owner_id == TEST_USER_ID)
        .options(selectinload(Document.chunks))
    )
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    return DocumentDetailResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        created_at=doc.created_at,
        chunks=[
            ChunkResponse(
                id=c.id,
                index=c.index,
                content=c.content,
                token_count=c.token_count,
            )
            for c in sorted(doc.chunks, key=lambda c: c.index)
        ],
    )
