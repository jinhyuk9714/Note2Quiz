from __future__ import annotations

import uuid

from fastapi import APIRouter

from app.core.deps import DBSession
from app.schemas.document import DocumentResponse, DocumentUploadRequest
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
