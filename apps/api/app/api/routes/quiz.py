from __future__ import annotations

import json
import uuid
from collections.abc import AsyncGenerator
from typing import Literal

import anthropic
from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from starlette.responses import StreamingResponse

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
from app.services.quiz_generation import (
    generate_questions_for_chunk,
    generate_quiz_from_chunks,
    load_chunks,
    save_quiz_to_db,
)
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


def _sse_event(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False, default=str)}\n\n"


@router.post("/generate-stream")
@limiter.limit(settings.rate_limit_quiz_gen)  # pyright: ignore[reportUntypedFunctionDecorator,reportUnknownMemberType]
async def generate_quiz_stream(
    request: Request,
    payload: QuizGenerateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> StreamingResponse:
    # Verify user owns the document (before starting the stream)
    doc_stmt = select(Document).where(
        Document.id == payload.document_id,
        Document.owner_id == user_id,
    )
    doc_result = await db.execute(doc_stmt)
    doc = doc_result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    title = payload.title or f"{doc.title} 퀴즈"

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            chunks = await load_chunks(db, payload.document_id, payload.chunk_ids)
            client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
            questions_per_chunk = max(1, payload.n_questions // len(chunks))
            total = len(chunks)
            all_items: list[dict[str, object]] = []

            for i, chunk in enumerate(chunks):
                yield _sse_event(
                    "progress",
                    {
                        "step": "analyzing",
                        "current": i + 1,
                        "total": total,
                        "message": f"청크 {i + 1}/{total} 분석 중...",
                    },
                )
                items = await generate_questions_for_chunk(
                    client, chunk, questions_per_chunk, payload.quiz_types
                )
                all_items.extend(items)

            yield _sse_event(
                "progress",
                {
                    "step": "saving",
                    "current": total,
                    "total": total,
                    "message": "퀴즈 저장 중...",
                },
            )
            quiz = await save_quiz_to_db(
                db, payload.document_id, title, all_items, payload.n_questions, payload.quiz_types
            )

            yield _sse_event(
                "complete",
                {
                    "quiz_id": quiz.id,
                    "item_count": quiz.item_count,
                },
            )
        except ValueError as e:
            yield _sse_event("error", {"message": str(e)})
        except Exception:
            yield _sse_event("error", {"message": "퀴즈 생성 중 오류가 발생했습니다."})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/", response_model=PaginatedResponse[QuizListItemResponse])
async def list_quizzes(
    db: DBSession,
    user_id: CurrentUserID,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, min_length=1, max_length=200),
    document_id: uuid.UUID | None = None,
    attempt_status: Literal["all", "not_attempted", "attempted"] = Query(default="all"),
    score_min: int | None = Query(default=None, ge=0, le=100),
    score_max: int | None = Query(default=None, ge=0, le=100),
    sort_by: Literal["created_at", "title", "item_count", "latest_score"] = Query(
        default="created_at"
    ),
    order: Literal["asc", "desc"] = Query(default="desc"),
) -> PaginatedResponse[QuizListItemResponse]:
    # Attempt count subquery
    attempt_count_sq = (
        select(
            QuizAttempt.quiz_id,
            func.count(QuizAttempt.id).label("attempt_count"),
        )
        .where(QuizAttempt.user_id == user_id)
        .group_by(QuizAttempt.quiz_id)
        .subquery()
    )

    # Latest attempt subquery (window function)
    latest_numbered = (
        select(
            QuizAttempt.quiz_id,
            QuizAttempt.score,
            QuizAttempt.total,
            func.row_number()
            .over(
                partition_by=QuizAttempt.quiz_id,
                order_by=QuizAttempt.created_at.desc(),
            )
            .label("rn"),
        )
        .where(QuizAttempt.user_id == user_id)
        .subquery()
    )
    latest_sq = (
        select(
            latest_numbered.c.quiz_id,
            latest_numbered.c.score,
            latest_numbered.c.total,
        )
        .where(latest_numbered.c.rn == 1)
        .subquery()
    )

    # Main query with joins
    base = (
        select(
            Quiz,
            func.coalesce(attempt_count_sq.c.attempt_count, 0).label("attempt_count"),
            latest_sq.c.score.label("latest_score"),
            latest_sq.c.total.label("latest_total"),
        )
        .join(Quiz.document)
        .outerjoin(attempt_count_sq, Quiz.id == attempt_count_sq.c.quiz_id)
        .outerjoin(latest_sq, Quiz.id == latest_sq.c.quiz_id)
        .where(Document.owner_id == user_id)
    )

    if search:
        base = base.where(Quiz.title.ilike(f"%{search}%"))
    if document_id:
        base = base.where(Quiz.document_id == document_id)

    # Attempt status filter
    if attempt_status == "not_attempted":
        base = base.where(func.coalesce(attempt_count_sq.c.attempt_count, 0) == 0)
    elif attempt_status == "attempted":
        base = base.where(func.coalesce(attempt_count_sq.c.attempt_count, 0) > 0)

    # Score filter (percentage-based)
    if score_min is not None:
        base = base.where(
            latest_sq.c.total > 0,
            (latest_sq.c.score * 100.0 / latest_sq.c.total) >= score_min,
        )
    if score_max is not None:
        base = base.where(
            latest_sq.c.total > 0,
            (latest_sq.c.score * 100.0 / latest_sq.c.total) < score_max,
        )

    # Total count
    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    # Sorting
    sort_map = {
        "created_at": Quiz.created_at,
        "title": Quiz.title,
        "item_count": Quiz.item_count,
        "latest_score": func.coalesce(latest_sq.c.score, -1),
    }
    sort_col = sort_map[sort_by]
    base = base.order_by(sort_col.asc() if order == "asc" else sort_col.desc())

    # Pagination + eager load
    base = base.offset(offset).limit(limit)
    base = base.options(selectinload(Quiz.document))

    result = await db.execute(base)
    rows = result.all()

    return PaginatedResponse[QuizListItemResponse](
        items=[
            QuizListItemResponse(
                id=q.id,
                title=q.title,
                item_count=q.item_count,
                document_id=q.document_id,
                document_title=q.document.title if q.document else "",
                created_at=q.created_at,
                attempt_count=int(ac),
                latest_score=s,
                latest_total=t,
            )
            for q, ac, s, t in rows
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

    attempt, wrong_notes, wrong_notes_updated = await create_attempt_with_wrong_notes(
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
        wrong_notes_updated=wrong_notes_updated,
    )
