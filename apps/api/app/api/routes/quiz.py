from __future__ import annotations

import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from starlette.requests import Request

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.core.rate_limit import limiter
from app.models.attempt import QuizAttempt
from app.models.document import Document
from app.models.quiz import Quiz, QuizItem
from app.schemas.attempt import AnswerResult, QuizSubmitRequest, QuizSubmitResponse
from app.schemas.common import PaginatedResponse
from app.schemas.quiz import (
    QuizAttemptSummaryResponse,
    QuizGenerateRequest,
    QuizItemPublicResponse,
    QuizListItemResponse,
    QuizResponse,
)
from app.services.quiz_generation import generate_quiz_from_chunks
from app.services.wrong_note_service import create_attempt_with_wrong_notes

router = APIRouter(prefix="/quiz", tags=["quiz"])


def _quiz_to_response(quiz: Quiz) -> QuizResponse:
    return QuizResponse(
        id=quiz.id,
        title=quiz.title,
        item_count=quiz.item_count,
        created_at=quiz.created_at,
        items=[
            QuizItemPublicResponse(
                id=item.id,
                quiz_type=item.quiz_type.value,
                question=item.question,
                options=item.options,  # type: ignore[arg-type]
                concept_tags=item.concept_tags,
                difficulty=item.difficulty,
            )
            for item in quiz.items
        ],
    )


@router.post("/generate", response_model=QuizResponse, status_code=201)
@limiter.limit(settings.rate_limit_quiz_gen)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def generate_quiz(
    request: Request, payload: QuizGenerateRequest, db: DBSession, user_id: CurrentUserID
) -> QuizResponse:
    # Verify user owns the document
    doc_stmt = select(Document).where(
        Document.id == payload.document_id,
        Document.owner_id == user_id,
    )
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    title = payload.title or f"{doc.title} 퀴즈"

    try:
        quiz = await generate_quiz_from_chunks(
            db=db,
            document_id=payload.document_id,
            chunk_ids=payload.chunk_ids,
            n_questions=payload.n_questions,
            quiz_types=payload.quiz_types,
            title=title,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # Reload with items
    stmt = select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.items))
    result = await db.execute(stmt)
    quiz = result.scalar_one()

    return _quiz_to_response(quiz)


@router.get("/", response_model=PaginatedResponse[QuizListItemResponse])
async def list_quizzes(
    db: DBSession,
    user_id: CurrentUserID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    document_id: uuid.UUID | None = None,
    sort_by: Literal["created_at", "title"] = Query(default="created_at"),
    order: Literal["asc", "desc"] = Query(default="desc"),
) -> PaginatedResponse[QuizListItemResponse]:
    base = select(Quiz).join(Quiz.document).where(Document.owner_id == user_id)

    if search:
        base = base.where(Quiz.title.ilike(f"%{search}%"))
    if document_id:
        base = base.where(Quiz.document_id == document_id)

    # Total count
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Sorting + pagination
    sort_col = Quiz.created_at if sort_by == "created_at" else Quiz.title
    base = base.order_by(sort_col.asc() if order == "asc" else sort_col.desc())
    base = base.offset(offset).limit(limit)
    base = base.options(selectinload(Quiz.document))

    result = await db.execute(base)
    quizzes = list(result.scalars().all())

    if not quizzes:
        return PaginatedResponse[QuizListItemResponse](
            items=[], total=int(total), limit=limit, offset=offset
        )

    quiz_ids = [q.id for q in quizzes]

    # Attempt count per quiz
    stats_stmt = (
        select(
            QuizAttempt.quiz_id,
            func.count(QuizAttempt.id).label("attempt_count"),
        )
        .where(QuizAttempt.quiz_id.in_(quiz_ids), QuizAttempt.user_id == user_id)
        .group_by(QuizAttempt.quiz_id)
    )
    stats_result = await db.execute(stats_stmt)
    stats_map: dict[uuid.UUID, int] = {row.quiz_id: row.attempt_count for row in stats_result.all()}  # type: ignore[attr-defined]

    # Latest attempt per quiz (most recent first)
    latest_stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id.in_(quiz_ids), QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.created_at.desc())
    )
    latest_result = await db.execute(latest_stmt)
    latest_map: dict[uuid.UUID, QuizAttempt] = {}
    for attempt in latest_result.scalars().all():
        if attempt.quiz_id not in latest_map:
            latest_map[attempt.quiz_id] = attempt

    return PaginatedResponse[QuizListItemResponse](
        items=[
            QuizListItemResponse(
                id=q.id,
                title=q.title,
                item_count=q.item_count,
                document_id=q.document_id,
                document_title=q.document.title if q.document else "",
                created_at=q.created_at,
                attempt_count=stats_map.get(q.id, 0),
                latest_score=latest_map[q.id].score if q.id in latest_map else None,
                latest_total=latest_map[q.id].total if q.id in latest_map else None,
            )
            for q in quizzes
        ],
        total=int(total),
        limit=limit,
        offset=offset,
    )


@router.delete("/{quiz_id}", status_code=204)
async def delete_quiz(
    quiz_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    stmt = select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    await db.delete(quiz)
    await db.commit()
    return Response(status_code=204)


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: uuid.UUID, db: DBSession, user_id: CurrentUserID) -> QuizResponse:
    stmt = (
        select(Quiz)
        .join(Quiz.document)
        .where(Quiz.id == quiz_id, Document.owner_id == user_id)
        .options(selectinload(Quiz.items))
    )
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return _quiz_to_response(quiz)


@router.get("/{quiz_id}/attempts", response_model=list[QuizAttemptSummaryResponse])
async def list_quiz_attempts(
    quiz_id: uuid.UUID, db: DBSession, user_id: CurrentUserID
) -> list[QuizAttemptSummaryResponse]:
    # Verify ownership
    ownership_stmt = (
        select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    )
    ownership_result = await db.execute(ownership_stmt)
    if not ownership_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Quiz not found")

    stmt = (
        select(QuizAttempt)
        .where(QuizAttempt.quiz_id == quiz_id, QuizAttempt.user_id == user_id)
        .order_by(QuizAttempt.attempt_number.desc())
    )
    result = await db.execute(stmt)
    attempts = list(result.scalars().all())

    return [
        QuizAttemptSummaryResponse(
            attempt_id=a.id,
            attempt_number=a.attempt_number,
            score=a.score,
            total=a.total,
            created_at=a.created_at,
        )
        for a in attempts
    ]


@router.post("/{quiz_id}/submit", response_model=QuizSubmitResponse, status_code=201)
async def submit_quiz(
    quiz_id: uuid.UUID,
    payload: QuizSubmitRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizSubmitResponse:
    # Verify user owns the quiz (via document ownership)
    ownership_stmt = (
        select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    )
    ownership_result = await db.execute(ownership_stmt)
    if not ownership_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Quiz not found")

    attempt, wrong_notes = await create_attempt_with_wrong_notes(
        db=db,
        quiz_id=quiz_id,
        user_id=user_id,
        answers=[
            {"quiz_item_id": str(a.quiz_item_id), "user_answer": a.user_answer}
            for a in payload.answers
        ],
    )

    # Load quiz items to get correct_answer + explanation for all results
    item_ids = [uuid.UUID(str(g["quiz_item_id"])) for g in attempt.answers]
    item_stmt = select(QuizItem).where(QuizItem.id.in_(item_ids))
    item_result = await db.execute(item_stmt)
    items_map: dict[uuid.UUID, QuizItem] = {item.id: item for item in item_result.scalars().all()}

    results: list[AnswerResult] = []
    for g in attempt.answers:
        qi_id = uuid.UUID(str(g["quiz_item_id"]))
        item = items_map.get(qi_id)
        results.append(
            AnswerResult(
                quiz_item_id=qi_id,
                user_answer=str(g["user_answer"]),
                correct_answer=item.correct_answer if item else str(g["user_answer"]),
                is_correct=bool(g["is_correct"]),
                explanation=item.explanation if item else "",
                grading_method=str(g["grading_method"]) if g.get("grading_method") else None,
            )
        )

    return QuizSubmitResponse(
        attempt_id=attempt.id,
        attempt_number=attempt.attempt_number,
        score=attempt.score,
        total=attempt.total,
        results=results,
        wrong_notes_created=len(wrong_notes),
    )
