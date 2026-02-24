from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.requests import Request

from app.core.config import settings
from app.core.deps import CurrentUserID, DBSession
from app.core.rate_limit import limiter
from app.models.document import Document
from app.models.quiz import Quiz, QuizItem
from app.schemas.attempt import AnswerResult, QuizSubmitRequest, QuizSubmitResponse
from app.schemas.quiz import (
    QuizGenerateRequest,
    QuizItemResponse,
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
            QuizItemResponse(
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
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        quiz = await generate_quiz_from_chunks(
            db=db,
            document_id=payload.document_id,
            chunk_ids=payload.chunk_ids,
            n_questions=payload.n_questions,
            quiz_types=payload.quiz_types,
            title="Quiz from document",
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # Reload with items
    stmt = select(Quiz).where(Quiz.id == quiz.id).options(selectinload(Quiz.items))
    result = await db.execute(stmt)
    quiz = result.scalar_one()

    return _quiz_to_response(quiz)


@router.get("/", response_model=list[QuizListItemResponse])
async def list_quizzes(db: DBSession, user_id: CurrentUserID) -> list[QuizListItemResponse]:
    stmt = (
        select(Quiz)
        .join(Quiz.document)
        .where(Document.owner_id == user_id)
        .order_by(Quiz.created_at.desc())
    )
    result = await db.execute(stmt)
    quizzes = list(result.scalars().all())
    return [
        QuizListItemResponse(
            id=q.id,
            title=q.title,
            item_count=q.item_count,
            document_id=q.document_id,
            created_at=q.created_at,
        )
        for q in quizzes
    ]


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
            )
        )

    return QuizSubmitResponse(
        attempt_id=attempt.id,
        score=attempt.score,
        total=attempt.total,
        results=results,
        wrong_notes_created=len(wrong_notes),
    )
