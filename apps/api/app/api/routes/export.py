from __future__ import annotations

import uuid
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Query
from starlette.responses import Response

from app.core.deps import CurrentUserID, DBSession
from app.services.export_service import (
    generate_quiz_results_csv,
    generate_wrong_notes_csv,
    generate_wrong_notes_pdf,
)

router = APIRouter(prefix="/export", tags=["export"])


def _csv_response(content: str, filename: str) -> Response:
    encoded = quote(filename)
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
        },
    )


def _pdf_response(content: bytes, filename: str) -> Response:
    encoded = quote(filename)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded}",
        },
    )


@router.get("/wrong-notes/csv")
async def export_wrong_notes_csv(
    db: DBSession,
    user_id: CurrentUserID,
    is_mastered: bool | None = Query(default=None),
    concept_tag: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, max_length=200),
) -> Response:
    csv_str = await generate_wrong_notes_csv(
        db, user_id, is_mastered=is_mastered, concept_tag=concept_tag, search=search
    )
    return _csv_response(csv_str, "오답노트.csv")


@router.get("/wrong-notes/pdf")
async def export_wrong_notes_pdf(
    db: DBSession,
    user_id: CurrentUserID,
    is_mastered: bool | None = Query(default=None),
    concept_tag: str | None = Query(default=None, max_length=100),
    search: str | None = Query(default=None, max_length=200),
) -> Response:
    pdf_bytes = await generate_wrong_notes_pdf(
        db, user_id, is_mastered=is_mastered, concept_tag=concept_tag, search=search
    )
    return _pdf_response(pdf_bytes, "오답노트.pdf")


@router.get("/quiz/{quiz_id}/attempts/{attempt_id}/csv")
async def export_quiz_results_csv(
    quiz_id: uuid.UUID,
    attempt_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    csv_str = await generate_quiz_results_csv(db, user_id, quiz_id, attempt_id)
    if not csv_str:
        raise HTTPException(status_code=404, detail="Quiz or attempt not found")
    return _csv_response(csv_str, "퀴즈결과.csv")
