from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUserID, DBSession
from app.models.quiz import Quiz
from app.schemas.attempt import AnswerResult, QuizSubmitRequest, QuizSubmitResponse
from app.schemas.quiz import QuizGenerateRequest, QuizItemResponse, QuizResponse
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
async def generate_quiz(
    payload: QuizGenerateRequest, db: DBSession, _user_id: CurrentUserID
) -> QuizResponse:
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


@router.get("/{quiz_id}", response_model=QuizResponse)
async def get_quiz(quiz_id: uuid.UUID, db: DBSession, _user_id: CurrentUserID) -> QuizResponse:
    stmt = select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.items))
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
    attempt, wrong_notes = await create_attempt_with_wrong_notes(
        db=db,
        quiz_id=quiz_id,
        user_id=user_id,
        answers=[
            {"quiz_item_id": str(a.quiz_item_id), "user_answer": a.user_answer}
            for a in payload.answers
        ],
    )

    # Build results from graded answers
    wrong_map: dict[uuid.UUID, str] = {n.quiz_item_id: n.correct_answer for n in wrong_notes}
    results: list[AnswerResult] = []
    for g in attempt.answers:
        qi_id = uuid.UUID(str(g["quiz_item_id"]))
        results.append(
            AnswerResult(
                quiz_item_id=qi_id,
                user_answer=str(g["user_answer"]),
                correct_answer=wrong_map.get(qi_id, str(g["user_answer"])),
                is_correct=bool(g["is_correct"]),
                explanation="",
            )
        )

    return QuizSubmitResponse(
        attempt_id=attempt.id,
        score=attempt.score,
        total=attempt.total,
        results=results,
        wrong_notes_created=len(wrong_notes),
    )
