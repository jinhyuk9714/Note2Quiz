from __future__ import annotations

import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from starlette.requests import Request
from starlette.responses import StreamingResponse

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.core.llm_client import (
    CircuitBreakerOpenError,
)
from app.core.rate_limit import limiter
from app.models.attempt import QuizAttempt
from app.models.document import Document
from app.models.quiz import Quiz, QuizItem, QuizType
from app.schemas.attempt import AnswerResult, QuizSubmitRequest, QuizSubmitResponse
from app.schemas.common import PaginatedResponse
from app.schemas.quiz import (
    AttemptDetailResponse,
    AttemptItemResult,
    QuizAttemptSummaryResponse,
    QuizGenerateRequest,
    QuizItemCreateRequest,
    QuizItemPublicResponse,
    QuizItemStudyResponse,
    QuizItemUpdateRequest,
    QuizListItemResponse,
    QuizResponse,
    QuizStudyResponse,
    QuizUpdateRequest,
)
from app.schemas.share import ShareInfoResponse, ShareToggleRequest
from app.services.quiz_generation import (
    InsufficientContentError,
    NoChunksFoundError,
    NoGeneratedItemsError,
    generate_quiz_from_chunks,
    generate_quiz_with_analysis,
)
from app.services.share_service import ensure_unique_share_code
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
        is_shared=quiz.is_shared,
        share_code=quiz.share_code,
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

    if payload.focus_concepts:
        concept_label = ", ".join(payload.focus_concepts[:2])
        title = payload.title or f"{doc.title} - {concept_label} 집중 퀴즈"
    else:
        title = payload.title or f"{doc.title} 퀴즈"

    try:
        quiz = await generate_quiz_from_chunks(
            db=db,
            document_id=payload.document_id,
            chunk_ids=payload.chunk_ids,
            n_questions=payload.n_questions,
            quiz_types=payload.quiz_types,
            title=title,
            focus_concepts=payload.focus_concepts,
            document_title=doc.title,
        )
    except NoChunksFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except InsufficientContentError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except NoGeneratedItemsError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except CircuitBreakerOpenError as e:
        raise HTTPException(
            status_code=503,
            detail="AI service temporarily unavailable. Please try again later.",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail="Quiz generation failed due to AI service error.",
        ) from e

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

    if payload.focus_concepts:
        concept_label = ", ".join(payload.focus_concepts[:2])
        title = payload.title or f"{doc.title} - {concept_label} 집중 퀴즈"
    else:
        title = payload.title or f"{doc.title} 퀴즈"

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            yield _sse_event(
                "progress",
                {"step": "analyzing", "current": 0, "total": 3, "message": "문서 분석 중..."},
            )

            quiz = await generate_quiz_with_analysis(
                db=db,
                document_id=payload.document_id,
                chunk_ids=payload.chunk_ids,
                n_questions=payload.n_questions,
                quiz_types=payload.quiz_types,
                title=title,
                focus_concepts=payload.focus_concepts,
                document_title=doc.title,
            )

            yield _sse_event(
                "complete",
                {
                    "quiz_id": quiz.id,
                    "item_count": quiz.item_count,
                },
            )
        except CircuitBreakerOpenError:
            yield _sse_event(
                "error",
                {"message": "AI 서비스가 일시적으로 사용 불가합니다. 잠시 후 다시 시도해주세요."},
            )
        except NoChunksFoundError:
            yield _sse_event("error", {"message": "문서에서 학습 자료를 찾을 수 없습니다."})
        except InsufficientContentError as e:
            yield _sse_event("error", {"message": str(e)})
        except NoGeneratedItemsError:
            yield _sse_event("error", {"message": "퀴즈 생성에 실패했습니다. 다시 시도해주세요."})
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


def _build_attempt_stats_cte(user_id: uuid.UUID) -> Any:
    """Build a CTE for per-quiz attempt stats (count + latest score).

    Using a CTE instead of a subquery allows the database to compute
    the window function result once and reference it from both the data
    query and the count query.
    """
    attempt_numbered = (
        select(
            QuizAttempt.quiz_id,
            QuizAttempt.score,
            QuizAttempt.total,
            func.count(QuizAttempt.id)
            .over(partition_by=QuizAttempt.quiz_id)
            .label("attempt_count"),
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
    return (
        select(
            attempt_numbered.c.quiz_id,
            attempt_numbered.c.attempt_count,
            attempt_numbered.c.score,
            attempt_numbered.c.total,
        )
        .where(attempt_numbered.c.rn == 1)
        .cte("attempt_stats")
    )


def _apply_quiz_filters(
    query: Any,
    cte: Any,
    *,
    search: str | None,
    document_id: uuid.UUID | None,
    attempt_status: str,
    score_min: int | None,
    score_max: int | None,
) -> Any:
    """Apply shared filter conditions to both data and count queries."""
    if search:
        query = query.where(Quiz.title.ilike(f"%{search}%"))
    if document_id:
        query = query.where(Quiz.document_id == document_id)
    if attempt_status == "not_attempted":
        query = query.where(func.coalesce(cte.c.attempt_count, 0) == 0)
    elif attempt_status == "attempted":
        query = query.where(func.coalesce(cte.c.attempt_count, 0) > 0)
    if score_min is not None:
        query = query.where(
            cte.c.total > 0,
            (cte.c.score * 100.0 / cte.c.total) >= score_min,
        )
    if score_max is not None:
        query = query.where(
            cte.c.total > 0,
            (cte.c.score * 100.0 / cte.c.total) < score_max,
        )
    return query


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
    # CTE — window functions computed once, reused by data + count queries
    attempt_stats = _build_attempt_stats_cte(user_id)

    _fkw: dict[str, Any] = dict(
        search=search,
        document_id=document_id,
        attempt_status=attempt_status,
        score_min=score_min,
        score_max=score_max,
    )

    # Total count
    count_q = (
        select(func.count(Quiz.id))
        .join(Quiz.document)
        .outerjoin(attempt_stats, Quiz.id == attempt_stats.c.quiz_id)
        .where(Document.owner_id == user_id)
    )
    count_q = _apply_quiz_filters(count_q, attempt_stats, **_fkw)
    total = (await db.execute(count_q)).scalar_one()

    # Data query
    data_q = (
        select(
            Quiz,
            func.coalesce(attempt_stats.c.attempt_count, 0).label("attempt_count"),
            attempt_stats.c.score.label("latest_score"),
            attempt_stats.c.total.label("latest_total"),
        )
        .join(Quiz.document)
        .outerjoin(attempt_stats, Quiz.id == attempt_stats.c.quiz_id)
        .where(Document.owner_id == user_id)
    )
    data_q = _apply_quiz_filters(data_q, attempt_stats, **_fkw)

    # Sorting
    sort_map = {
        "created_at": Quiz.created_at,
        "title": Quiz.title,
        "item_count": Quiz.item_count,
        "latest_score": func.coalesce(attempt_stats.c.score, -1),
    }
    sort_col = sort_map[sort_by]
    data_q = data_q.order_by(sort_col.asc() if order == "asc" else sort_col.desc())

    # Pagination + eager load
    data_q = data_q.offset(offset).limit(limit)
    data_q = data_q.options(selectinload(Quiz.document))

    result = await db.execute(data_q)
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
                is_shared=q.is_shared,
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


@router.patch("/{quiz_id}", response_model=QuizResponse)
async def update_quiz(
    quiz_id: uuid.UUID,
    payload: QuizUpdateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizResponse:
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

    quiz.title = payload.title
    await db.commit()
    await db.refresh(quiz)

    return _quiz_to_response(quiz)


@router.patch("/{quiz_id}/items/{item_id}", response_model=QuizItemStudyResponse)
async def update_quiz_item(
    quiz_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: QuizItemUpdateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizItemStudyResponse:
    quiz_stmt = (
        select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    )
    quiz_result = await db.execute(quiz_stmt)
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    item_stmt = select(QuizItem).where(QuizItem.id == item_id, QuizItem.quiz_id == quiz_id)
    item_result = await db.execute(item_stmt)
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Quiz item not found")

    update_data = payload.model_dump(exclude_unset=True)

    # MCQ cross-validation
    if item.quiz_type == QuizType.MCQ:
        final_options = update_data.get("options", item.options)
        final_answer = update_data.get("correct_answer", item.correct_answer)
        if final_options and len(final_options) < 2:
            raise HTTPException(status_code=422, detail="MCQ items require at least 2 options")
        if final_options and final_answer not in final_options:
            raise HTTPException(
                status_code=422,
                detail=f"correct_answer '{final_answer}' must be one of the option keys",
            )

    for field, value in update_data.items():
        setattr(item, field, value)

    await db.commit()
    await db.refresh(item)

    return QuizItemStudyResponse(
        id=item.id,
        quiz_type=item.quiz_type.value,
        question=item.question,
        correct_answer=item.correct_answer,
        explanation=item.explanation,
        options=item.options,  # type: ignore[arg-type]
        concept_tags=item.concept_tags,
        difficulty=item.difficulty,
    )


@router.delete("/{quiz_id}/items/{item_id}", status_code=204)
async def delete_quiz_item(
    quiz_id: uuid.UUID,
    item_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> Response:
    quiz_stmt = (
        select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    )
    quiz_result = await db.execute(quiz_stmt)
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    item_stmt = select(QuizItem).where(QuizItem.id == item_id, QuizItem.quiz_id == quiz_id)
    item_result = await db.execute(item_stmt)
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Quiz item not found")

    if quiz.item_count <= 1:
        raise HTTPException(
            status_code=422,
            detail="Cannot delete the last item. Delete the quiz instead.",
        )

    await db.delete(item)
    quiz.item_count -= 1
    await db.commit()

    return Response(status_code=204)


@router.post("/{quiz_id}/items", response_model=QuizItemStudyResponse, status_code=201)
async def create_quiz_item(
    quiz_id: uuid.UUID,
    payload: QuizItemCreateRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizItemStudyResponse:
    quiz_stmt = (
        select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    )
    quiz_result = await db.execute(quiz_stmt)
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # MCQ validation
    if payload.quiz_type == "mcq":
        if not payload.options or len(payload.options) < 2:
            raise HTTPException(status_code=422, detail="MCQ items require at least 2 options")
        if payload.correct_answer not in payload.options:
            raise HTTPException(
                status_code=422,
                detail=f"correct_answer '{payload.correct_answer}' must be one of the option keys",
            )

    item = QuizItem(
        quiz_id=quiz_id,
        source_chunk_id=None,
        quiz_type=QuizType(payload.quiz_type),
        question=payload.question,
        correct_answer=payload.correct_answer,
        explanation=payload.explanation,
        options=payload.options,
        concept_tags=payload.concept_tags,
        difficulty=payload.difficulty,
    )
    db.add(item)
    quiz.item_count += 1
    await db.commit()
    await db.refresh(item)

    return QuizItemStudyResponse(
        id=item.id,
        quiz_type=item.quiz_type.value,
        question=item.question,
        correct_answer=item.correct_answer,
        explanation=item.explanation,
        options=item.options,  # type: ignore[arg-type]
        concept_tags=item.concept_tags,
        difficulty=item.difficulty,
    )


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


@router.get("/{quiz_id}/study", response_model=QuizStudyResponse)
async def get_quiz_for_study(
    quiz_id: uuid.UUID, db: DBSession, user_id: CurrentUserID
) -> QuizStudyResponse:
    """Return quiz with correct answers and explanations for flashcard/study mode."""
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

    return QuizStudyResponse(
        id=quiz.id,
        title=quiz.title,
        item_count=quiz.item_count,
        created_at=quiz.created_at,
        items=[
            QuizItemStudyResponse(
                id=item.id,
                quiz_type=item.quiz_type.value,
                question=item.question,
                correct_answer=item.correct_answer,
                explanation=item.explanation,
                options=item.options,  # type: ignore[arg-type]
                concept_tags=item.concept_tags,
                difficulty=item.difficulty,
            )
            for item in quiz.items
        ],
    )


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


@router.get("/{quiz_id}/attempts/{attempt_id}", response_model=AttemptDetailResponse)
async def get_attempt_detail(
    quiz_id: uuid.UUID,
    attempt_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> AttemptDetailResponse:
    """Return per-item results for a specific past attempt."""
    quiz_stmt = (
        select(Quiz)
        .join(Quiz.document)
        .where(Quiz.id == quiz_id, Document.owner_id == user_id)
        .options(selectinload(Quiz.items))
    )
    quiz_result = await db.execute(quiz_stmt)
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    attempt_stmt = select(QuizAttempt).where(
        QuizAttempt.id == attempt_id,
        QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.user_id == user_id,
    )
    attempt_result = await db.execute(attempt_stmt)
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    items_map: dict[str, QuizItem] = {str(item.id): item for item in quiz.items}

    results: list[AttemptItemResult] = []
    for answer in attempt.answers:
        qi_id_str = str(answer["quiz_item_id"])
        item = items_map.get(qi_id_str)
        results.append(
            AttemptItemResult(
                quiz_item_id=uuid.UUID(qi_id_str),
                quiz_type=item.quiz_type.value if item else "unknown",
                question=item.question if item else "",
                user_answer=str(answer["user_answer"]),
                correct_answer=item.correct_answer if item else "",
                is_correct=bool(answer["is_correct"]),
                explanation=item.explanation if item else "",
                grading_method=str(answer["grading_method"])
                if answer.get("grading_method")
                else None,
                concept_tags=item.concept_tags if item else [],
                difficulty=item.difficulty if item else 0,
                options=item.options if item else None,  # type: ignore[arg-type]
            )
        )

    return AttemptDetailResponse(
        attempt_id=attempt.id,
        attempt_number=attempt.attempt_number,
        score=attempt.score,
        total=attempt.total,
        created_at=attempt.created_at,
        quiz_id=quiz.id,
        quiz_title=quiz.title,
        results=results,
    )


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

    try:
        attempt, wrong_notes, wrong_notes_updated = await create_attempt_with_wrong_notes(
            db=db,
            quiz_id=quiz_id,
            user_id=user_id,
            answers=[
                {"quiz_item_id": str(a.quiz_item_id), "user_answer": a.user_answer}
                for a in payload.answers
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

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


# ---------- Share management (owner-only) ----------


def _build_share_url(share_code: str | None) -> str | None:
    if not share_code:
        return None
    base = settings.frontend_base_url.rstrip("/")
    return f"{base}/quiz/shared/{share_code}"


@router.get("/{quiz_id}/share", response_model=ShareInfoResponse)
async def get_share_info(
    quiz_id: uuid.UUID, db: DBSession, user_id: CurrentUserID
) -> ShareInfoResponse:
    stmt = select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    return ShareInfoResponse(
        quiz_id=quiz.id,
        is_shared=quiz.is_shared,
        share_code=quiz.share_code,
        share_url=_build_share_url(quiz.share_code) if quiz.is_shared else None,
    )


@router.post("/{quiz_id}/share", response_model=ShareInfoResponse)
async def toggle_share(
    quiz_id: uuid.UUID,
    payload: ShareToggleRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> ShareInfoResponse:
    stmt = select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if payload.is_shared and not quiz.share_code:
        quiz.share_code = await ensure_unique_share_code(db)

    quiz.is_shared = payload.is_shared
    await db.commit()
    await db.refresh(quiz)

    return ShareInfoResponse(
        quiz_id=quiz.id,
        is_shared=quiz.is_shared,
        share_code=quiz.share_code,
        share_url=_build_share_url(quiz.share_code) if quiz.is_shared else None,
    )


@router.post("/{quiz_id}/share/regenerate", response_model=ShareInfoResponse)
async def regenerate_share_code(
    quiz_id: uuid.UUID,
    db: DBSession,
    user_id: CurrentUserID,
) -> ShareInfoResponse:
    stmt = select(Quiz).join(Quiz.document).where(Quiz.id == quiz_id, Document.owner_id == user_id)
    result = await db.execute(stmt)
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    quiz.share_code = await ensure_unique_share_code(db)
    quiz.is_shared = True
    await db.commit()
    await db.refresh(quiz)

    return ShareInfoResponse(
        quiz_id=quiz.id,
        is_shared=quiz.is_shared,
        share_code=quiz.share_code,
        share_url=_build_share_url(quiz.share_code),
    )
