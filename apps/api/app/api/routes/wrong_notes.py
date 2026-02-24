from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import DBSession
from app.models.attempt import WrongAnswerNote
from app.schemas.attempt import WrongAnswerNoteListResponse, WrongAnswerNoteResponse

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
