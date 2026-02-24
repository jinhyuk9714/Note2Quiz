from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DBSession
from app.models.attempt import WrongAnswerNote
from app.schemas.attempt import (
    WrongAnswerNoteListResponse,
    WrongAnswerNoteResponse,
    WrongAnswerNoteReviewRequest,
)
from app.services.wrong_note_service import calculate_next_review

router = APIRouter(prefix="/wrong-notes", tags=["wrong-notes"])

TEST_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@router.get("/", response_model=WrongAnswerNoteListResponse)
async def list_wrong_notes(
    db: DBSession,
    due_only: bool = Query(default=False, description="복습 시점이 된 노트만 조회"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> WrongAnswerNoteListResponse:
    stmt = (
        select(WrongAnswerNote)
        .where(WrongAnswerNote.user_id == TEST_USER_ID)
        .where(WrongAnswerNote.is_mastered == False)  # noqa: E712
        .options(selectinload(WrongAnswerNote.quiz_item))
    )

    if due_only:
        stmt = stmt.where(WrongAnswerNote.next_review_at <= datetime.now(UTC))

    stmt = stmt.order_by(WrongAnswerNote.next_review_at.asc())
    stmt = stmt.offset(offset).limit(limit)

    result = await db.execute(stmt)
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
                created_at=n.created_at,
            )
            for n in notes
        ],
        total=len(notes),
    )


@router.post("/{note_id}/review", response_model=WrongAnswerNoteResponse)
async def review_wrong_note(
    note_id: uuid.UUID,
    payload: WrongAnswerNoteReviewRequest,
    db: DBSession,
) -> WrongAnswerNoteResponse:
    stmt = (
        select(WrongAnswerNote)
        .where(WrongAnswerNote.id == note_id, WrongAnswerNote.user_id == TEST_USER_ID)
        .options(selectinload(WrongAnswerNote.quiz_item))
    )
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Wrong note not found")

    note.review_count += 1

    if payload.is_correct:
        note.consecutive_correct += 1
        note.next_review_at = calculate_next_review(note.consecutive_correct)
        if note.consecutive_correct >= 5:
            note.is_mastered = True
    else:
        note.consecutive_correct = 0
        note.next_review_at = calculate_next_review(0)

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
        created_at=note.created_at,
    )
