from __future__ import annotations

import asyncio
import uuid
from typing import Literal

from fastapi import APIRouter, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.models.document import Document
from app.models.folder import Folder
from app.models.quiz import Quiz
from app.schemas.common import PaginatedResponse
from app.schemas.document import (
    ChunkResponse,
    DocumentDetailResponse,
    DocumentResponse,
    DocumentUpdateRequest,
)
from app.schemas.folder import DocumentMoveRequest
from app.services.document_service import create_document_with_chunks
from app.services.ocr_service import (
    SUPPORTED_IMAGE_TYPES,
    ImageExtractionError,
    extract_text_from_image,
)
from app.services.pdf_service import PDFExtractionError, extract_text_from_pdf

router = APIRouter(prefix="/documents", tags=["documents"])

_MAX_UPLOAD_BYTES = settings.max_upload_size_mb * 1024 * 1024

_SORT_COLUMNS = {
    "created_at": Document.created_at,
    "title": Document.title,
    "char_count": Document.char_count,
}


@router.post("/", response_model=DocumentResponse, status_code=201)
async def upload_document(
    db: DBSession,
    user_id: CurrentUserID,
    title: str = Form(min_length=1, max_length=500),  # noqa: B008
    text: str | None = Form(default=None, min_length=10),  # noqa: B008
    file: UploadFile | None = File(default=None),  # noqa: B008
    folder_id: uuid.UUID | None = Form(default=None),  # noqa: B008
) -> DocumentResponse:
    # Exactly one of text / file must be provided
    if text and file:
        raise HTTPException(status_code=422, detail="Provide either 'text' or 'file', not both.")
    if not text and not file:
        raise HTTPException(
            status_code=422, detail="Either 'text' or 'file' (PDF/image) is required."
        )

    source_type = "text"
    raw_text = text or ""

    if file is not None:
        file_bytes = await file.read()
        if len(file_bytes) > _MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds maximum size ({settings.max_upload_size_mb} MB).",
            )

        if file.content_type == "application/pdf":
            try:
                raw_text = await asyncio.to_thread(extract_text_from_pdf, file_bytes)
            except PDFExtractionError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            source_type = "pdf"
        elif file.content_type in SUPPORTED_IMAGE_TYPES:
            try:
                raw_text = await extract_text_from_image(file_bytes, file.content_type)
            except ImageExtractionError as exc:
                raise HTTPException(status_code=422, detail=str(exc)) from exc
            source_type = "image"
        else:
            raise HTTPException(
                status_code=422,
                detail="Only PDF and image files (JPEG, PNG, WEBP) are supported.",
            )

    # Validate folder ownership if provided
    resolved_folder_name: str | None = None
    if folder_id is not None:
        f_stmt = select(Folder).where(Folder.id == folder_id, Folder.owner_id == user_id)
        f_result = await db.execute(f_stmt)
        folder = f_result.scalar_one_or_none()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        resolved_folder_name = folder.name

    doc = await create_document_with_chunks(
        db=db,
        owner_id=user_id,
        title=title,
        raw_text=raw_text,
        source_type=source_type,
        folder_id=folder_id,
    )
    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        quiz_count=0,
        folder_id=doc.folder_id,
        folder_name=resolved_folder_name,
        created_at=doc.created_at,
    )


@router.get("/", response_model=PaginatedResponse[DocumentResponse])
async def list_documents(
    db: DBSession,
    user_id: CurrentUserID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    source_type: Literal["text", "pdf", "image"] | None = Query(default=None),
    folder_id: str | None = Query(default=None),
    sort_by: Literal["created_at", "title", "char_count"] = Query(default="created_at"),
    order: Literal["asc", "desc"] = Query(default="desc"),
) -> PaginatedResponse[DocumentResponse]:
    base = select(Document).where(Document.owner_id == user_id)

    if search:
        base = base.where(Document.title.ilike(f"%{search}%"))
    if source_type:
        base = base.where(Document.source_type == source_type)
    if folder_id is not None:
        if folder_id == "none":
            base = base.where(Document.folder_id.is_(None))
        else:
            try:
                folder_uuid = uuid.UUID(folder_id)
            except ValueError as e:
                raise HTTPException(status_code=422, detail="Invalid folder_id format") from e
            base = base.where(Document.folder_id == folder_uuid)

    # Total count
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Sorting + pagination
    col = _SORT_COLUMNS[sort_by]
    base = base.order_by(col.asc() if order == "asc" else col.desc())
    base = base.offset(offset).limit(limit)

    result = await db.execute(base)
    docs = list(result.scalars().all())

    # Quiz counts per document (single query)
    quiz_count_map: dict[uuid.UUID, int] = {}
    folder_name_map: dict[uuid.UUID, str] = {}
    if docs:
        doc_ids = [d.id for d in docs]
        qc_stmt = (
            select(Quiz.document_id, func.count(Quiz.id))
            .where(Quiz.document_id.in_(doc_ids))
            .group_by(Quiz.document_id)
        )
        qc_result = await db.execute(qc_stmt)
        quiz_count_map = {row[0]: row[1] for row in qc_result.all()}

        # Folder names for docs that have folder_id
        folder_ids = {d.folder_id for d in docs if d.folder_id is not None}
        if folder_ids:
            fn_stmt = select(Folder.id, Folder.name).where(Folder.id.in_(folder_ids))
            fn_result = await db.execute(fn_stmt)
            folder_name_map = {row[0]: row[1] for row in fn_result.all()}

    return PaginatedResponse[DocumentResponse](
        items=[
            DocumentResponse(
                id=d.id,
                title=d.title,
                source_type=d.source_type,
                char_count=d.char_count,
                chunk_count=d.chunk_count,
                quiz_count=quiz_count_map.get(d.id, 0),
                folder_id=d.folder_id,
                folder_name=folder_name_map.get(d.folder_id) if d.folder_id else None,
                created_at=d.created_at,
            )
            for d in docs
        ],
        total=int(total),
        limit=limit,
        offset=offset,
    )


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

    # Quiz count for this document
    qc_stmt = select(func.count(Quiz.id)).where(Quiz.document_id == doc.id)
    doc_quiz_count = (await db.execute(qc_stmt)).scalar_one()

    # Folder name
    folder_name: str | None = None
    if doc.folder_id:
        fn_stmt = select(Folder.name).where(Folder.id == doc.folder_id)
        folder_name = (await db.execute(fn_stmt)).scalar_one_or_none()

    return DocumentDetailResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        quiz_count=int(doc_quiz_count),
        folder_id=doc.folder_id,
        folder_name=folder_name,
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


@router.patch("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> DocumentResponse:
    stmt = select(Document).where(Document.id == document_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.title = payload.title
    await db.commit()
    await db.refresh(doc)

    qc_stmt = select(func.count(Quiz.id)).where(Quiz.document_id == doc.id)
    doc_quiz_count = (await db.execute(qc_stmt)).scalar_one()

    # Folder name
    upd_folder_name: str | None = None
    if doc.folder_id:
        fn_stmt = select(Folder.name).where(Folder.id == doc.folder_id)
        upd_folder_name = (await db.execute(fn_stmt)).scalar_one_or_none()

    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        quiz_count=int(doc_quiz_count),
        folder_id=doc.folder_id,
        folder_name=upd_folder_name,
        created_at=doc.created_at,
    )


@router.patch("/{document_id}/folder", response_model=DocumentResponse)
async def move_document_to_folder(
    document_id: uuid.UUID,
    payload: DocumentMoveRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> DocumentResponse:
    stmt = select(Document).where(Document.id == document_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    move_folder_name: str | None = None
    if payload.folder_id is not None:
        f_stmt = select(Folder).where(Folder.id == payload.folder_id, Folder.owner_id == user_id)
        f_result = await db.execute(f_stmt)
        folder = f_result.scalar_one_or_none()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        move_folder_name = folder.name

    doc.folder_id = payload.folder_id
    await db.commit()
    await db.refresh(doc)

    qc_stmt = select(func.count(Quiz.id)).where(Quiz.document_id == doc.id)
    doc_quiz_count = (await db.execute(qc_stmt)).scalar_one()

    return DocumentResponse(
        id=doc.id,
        title=doc.title,
        source_type=doc.source_type,
        char_count=doc.char_count,
        chunk_count=doc.chunk_count,
        quiz_count=int(doc_quiz_count),
        folder_id=doc.folder_id,
        folder_name=move_folder_name,
        created_at=doc.created_at,
    )


@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    stmt = select(Document).where(Document.id == document_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return Response(status_code=204)
