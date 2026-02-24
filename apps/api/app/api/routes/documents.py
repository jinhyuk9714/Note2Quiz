from __future__ import annotations

import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.models.document import Document
from app.schemas.document import (
    ChunkResponse,
    DocumentDetailResponse,
    DocumentResponse,
)
from app.services.document_service import create_document_with_chunks
from app.services.pdf_service import PDFExtractionError, extract_text_from_pdf

router = APIRouter(prefix="/documents", tags=["documents"])

_MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(
    db: DBSession,
    user_id: CurrentUserID,
    title: str = Form(min_length=1, max_length=500),  # noqa: B008
    text: str | None = Form(default=None, min_length=10),  # noqa: B008
    file: UploadFile | None = File(default=None),  # noqa: B008
) -> DocumentResponse:
    # Exactly one of text / file must be provided
    if text and file:
        raise HTTPException(status_code=422, detail="Provide either 'text' or 'file', not both.")
    if not text and not file:
        raise HTTPException(status_code=422, detail="Either 'text' or 'file' (PDF) is required.")

    source_type = "text"
    raw_text = text or ""

    if file is not None:
        if file.content_type not in ("application/pdf",):
            raise HTTPException(status_code=422, detail="Only PDF files are supported.")
        pdf_bytes = await file.read()
        if len(pdf_bytes) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum size ({settings.max_upload_size_mb} MB).",
            )
        try:
            raw_text = extract_text_from_pdf(pdf_bytes)
        except PDFExtractionError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        source_type = "pdf"

    doc = await create_document_with_chunks(
        db=db,
        owner_id=user_id,
        title=title,
        raw_text=raw_text,
        source_type=source_type,
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
async def list_documents(db: DBSession, user_id: CurrentUserID) -> list[DocumentResponse]:
    stmt = select(Document).where(Document.owner_id == user_id).order_by(Document.created_at.desc())
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
    user_id: CurrentUserID,
) -> DocumentDetailResponse:
    stmt = (
        select(Document)
        .where(Document.id == document_id, Document.owner_id == user_id)
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
