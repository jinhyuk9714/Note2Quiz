from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.deps import CurrentUserID, DBSession
from app.models.attempt import QuizAttempt
from app.models.quiz import Quiz, QuizItem
from app.models.user import User
from app.schemas.attempt import AnswerResult, QuizSubmitRequest, QuizSubmitResponse
from app.schemas.quiz import QuizItemStudyResponse, QuizStudyResponse
from app.schemas.share import QuizCopyResponse, SharedQuizItemResponse, SharedQuizResponse
from app.services.share_service import duplicate_quiz_for_user, get_shared_quiz
from app.services.wrong_note_service import create_attempt_with_wrong_notes

router = APIRouter(prefix="/share", tags=["share"])


@router.get("/{share_code}", response_model=SharedQuizResponse)
async def get_shared_quiz_by_code(
    share_code: str,
    db: DBSession,
    user_id: CurrentUserID,  # noqa: ARG001
) -> SharedQuizResponse:
    """Access a shared quiz by its share code."""
    quiz = await get_shared_quiz(db, share_code)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or no longer shared")

    # Get owner display name
    owner_stmt = select(User.display_name).where(User.id == quiz.document.owner_id)
    owner_result = await db.execute(owner_stmt)
    owner_name = owner_result.scalar_one_or_none() or "Unknown"

    return SharedQuizResponse(
        id=quiz.id,
        title=quiz.title,
        item_count=quiz.item_count,
        created_at=quiz.created_at,
        owner_display_name=owner_name,
        items=[
            SharedQuizItemResponse(
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


@router.post("/{share_code}/submit", response_model=QuizSubmitResponse, status_code=201)
async def submit_shared_quiz(
    share_code: str,
    payload: QuizSubmitRequest,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizSubmitResponse:
    """Submit answers for a shared quiz. Creates attempt + wrong notes for the current user."""
    quiz = await get_shared_quiz(db, share_code)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or no longer shared")

    try:
        attempt, wrong_notes, wrong_notes_updated = await create_attempt_with_wrong_notes(
            db=db,
            quiz_id=quiz.id,
            user_id=user_id,
            answers=[
                {"quiz_item_id": str(a.quiz_item_id), "user_answer": a.user_answer}
                for a in payload.answers
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    # Build results
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


@router.get("/{share_code}/study", response_model=QuizStudyResponse)
async def get_shared_quiz_for_study(
    share_code: str,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizStudyResponse:
    """Return shared quiz with answers — only if user has attempted it at least once."""
    quiz = await get_shared_quiz(db, share_code)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or no longer shared")

    # Check user has at least one attempt
    attempt_stmt = select(QuizAttempt.id).where(
        QuizAttempt.quiz_id == quiz.id, QuizAttempt.user_id == user_id
    )
    attempt_result = await db.execute(attempt_stmt)
    if not attempt_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Complete the quiz first to view answers")

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


@router.post("/{share_code}/copy", response_model=QuizCopyResponse, status_code=201)
async def copy_shared_quiz(
    share_code: str,
    db: DBSession,
    user_id: CurrentUserID,
) -> QuizCopyResponse:
    """Duplicate a shared quiz into the current user's account."""
    quiz = await get_shared_quiz(db, share_code)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found or no longer shared")

    # Ensure items are loaded
    if not quiz.items:
        stmt = (
            select(Quiz)
            .where(Quiz.id == quiz.id)
            .options(selectinload(Quiz.items), selectinload(Quiz.document))
        )
        result = await db.execute(stmt)
        quiz = result.scalar_one()

    new_doc, new_quiz = await duplicate_quiz_for_user(db, quiz, user_id)
    await db.commit()

    return QuizCopyResponse(
        quiz_id=new_quiz.id,
        document_id=new_doc.id,
        title=new_quiz.title,
        item_count=new_quiz.item_count,
    )
