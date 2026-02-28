from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import String, cast, func, select
from sqlalchemy.orm import selectinload
from starlette.responses import Response

from app.core.deps import CurrentUserID, DBSession
from app.models.attempt import WrongAnswerNote
from app.models.quiz import QuizItem
from app.schemas.attempt import (
    WrongAnswerNoteListResponse,
    WrongAnswerNoteResponse,
    WrongAnswerNoteReviewRequest,
)
from app.services.wrong_note_service import apply_sm2_review

router = APIRouter(prefix="/wrong-notes", tags=["wrong-notes"])


@router.get("/", response_model=WrongAnswerNoteListResponse)
async def list_wrong_notes(
    db: DBSession,
    user_id: CurrentUserID,
    due_only: bool = Query(default=False, description="복습 시점이 된 노트만 조회"),
    is_mastered: bool | None = Query(
        default=None, description="None=미숙달만, True=숙달만, False=미숙달만"
    ),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    concept_tag: str | None = Query(
        default=None, min_length=1, max_length=100, description="개념 태그로 필터링"
    ),
    sort_by: Literal["next_review_at", "created_at"] = Query(default="next_review_at"),
    order: Literal["asc", "desc"] = Query(default="asc"),
) -> WrongAnswerNoteListResponse:
    base = select(WrongAnswerNote).where(WrongAnswerNote.user_id == user_id)

    if is_mastered is not None:
        base = base.where(WrongAnswerNote.is_mastered == is_mastered)  # noqa: E712
    else:
        base = base.where(WrongAnswerNote.is_mastered == False)  # noqa: E712

    if due_only:
        base = base.where(WrongAnswerNote.next_review_at <= datetime.now(UTC))
    if concept_tag:
        dialect = db.bind.dialect.name if db.bind else "unknown"  # type: ignore[union-attr]
        if dialect == "postgresql":
            base = base.where(
                WrongAnswerNote.concept_tags.op("@>")(f'["{concept_tag}"]')  # type: ignore[union-attr]
            )
        else:
            base = base.where(
                cast(WrongAnswerNote.concept_tags, String).contains(f'"{concept_tag}"')
            )
    if search:
        base = base.join(WrongAnswerNote.quiz_item).where(QuizItem.question.ilike(f"%{search}%"))

    # Total count (before pagination)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Sorting + pagination
    sort_col = (
        WrongAnswerNote.next_review_at
        if sort_by == "next_review_at"
        else WrongAnswerNote.created_at
    )
    base = base.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    base = base.offset(offset).limit(limit)
    base = base.options(selectinload(WrongAnswerNote.quiz_item))

    result = await db.execute(base)
    notes = list(result.scalars().all())

    return WrongAnswerNoteListResponse(
        notes=[
            WrongAnswerNoteResponse(
                id=n.id,
                quiz_item_id=n.quiz_item_id,
                question=n.quiz_item.question if n.quiz_item else "",
                user_answer=n.user_answer,
                correct_answer=n.correct_answer,
                wrong_reason=n.wrong_reason,
                concept_tags=n.concept_tags,
                next_review_at=n.next_review_at,
                consecutive_correct=n.consecutive_correct,
                is_mastered=n.is_mastered,
                ease_factor=n.ease_factor,
                interval_days=n.interval_days,
                created_at=n.created_at,
            )
            for n in notes
        ],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.post("/{note_id}/review", response_model=WrongAnswerNoteResponse)
async def review_wrong_note(
    note_id: uuid.UUID,
    payload: WrongAnswerNoteReviewRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> WrongAnswerNoteResponse:
    stmt = (
        select(WrongAnswerNote)
        .where(WrongAnswerNote.id == note_id, WrongAnswerNote.user_id == user_id)
        .options(selectinload(WrongAnswerNote.quiz_item))
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Wrong note not found")

    apply_sm2_review(note, payload.quality)

    await db.commit()
    await db.refresh(note)

    return WrongAnswerNoteResponse(
        id=note.id,
        quiz_item_id=note.quiz_item_id,
        question=note.quiz_item.question if note.quiz_item else "",
        user_answer=note.user_answer,
        correct_answer=note.correct_answer,
        wrong_reason=note.wrong_reason,
        concept_tags=note.concept_tags,
        next_review_at=note.next_review_at,
        consecutive_correct=note.consecutive_correct,
        is_mastered=note.is_mastered,
        ease_factor=note.ease_factor,
        interval_days=note.interval_days,
        created_at=note.created_at,
    )


@router.delete("/{note_id}", status_code=204)
async def delete_wrong_note(
    note_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    stmt = select(WrongAnswerNote).where(
        WrongAnswerNote.id == note_id,
        WrongAnswerNote.user_id == user_id,
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Wrong note not found")
    await db.delete(note)
    await db.commit()
    return Response(status_code=204)
