from __future__ import annotations

import hashlib
import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.folder import Folder
from app.models.quiz import Quiz, QuizItem, QuizType

_CONCEPT_POOL = [
    "미적분",
    "선형대수",
    "확률론",
    "통계학",
    "미분방정식",
    "벡터공간",
    "행렬",
    "고유값",
    "적분",
    "극한",
    "연속성",
    "수열",
    "급수",
    "편미분",
    "중적분",
    "확률분포",
    "기댓값",
    "분산",
    "가설검정",
    "회귀분석",
    "최적화",
    "라그랑주",
    "테일러급수",
    "푸리에급수",
    "라플라스",
    "그린함수",
    "스토크스",
    "발산정리",
    "가우스",
    "베이즈정리",
]

_QUIZ_TYPES = [QuizType.MCQ, QuizType.SHORT_ANSWER, QuizType.TRUE_FALSE, QuizType.FILL_BLANK]


@dataclass
class SeedResult:
    user_id: uuid.UUID
    document_ids: list[uuid.UUID]
    folder_ids: list[uuid.UUID]
    quiz_ids: list[uuid.UUID]
    item_ids: list[uuid.UUID]
    attempt_ids: list[uuid.UUID]
    wrong_note_ids: list[uuid.UUID]


async def seed_benchmark_data(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    n_documents: int = 100,
    n_chunks_per_doc: int = 3,
    n_folders: int = 10,
    n_quizzes_per_doc: int = 2,
    n_items_per_quiz: int = 10,
    n_attempts: int = 3000,
    n_wrong_notes: int = 1000,
) -> SeedResult:
    """Create large-scale test data for performance benchmarks."""
    rng = random.Random(42)  # noqa: S311 – deterministic seed
    now = datetime.now(UTC)

    # ── Folders ──
    folders: list[Folder] = []
    for i in range(n_folders):
        folders.append(
            Folder(
                owner_id=user_id,
                name=f"폴더 {i + 1}",
                color=f"#{rng.randint(0, 0xFFFFFF):06x}",
            )
        )
    db.add_all(folders)
    await db.flush()
    folder_ids = [f.id for f in folders]

    # ── Documents + Chunks ──
    documents: list[Document] = []
    all_chunks: list[Chunk] = []
    for i in range(n_documents):
        doc = Document(
            owner_id=user_id,
            title=f"강의노트 {i + 1}: {rng.choice(_CONCEPT_POOL)}",
            source_type=rng.choice(["text", "pdf"]),
            char_count=rng.randint(2000, 20000),
            chunk_count=n_chunks_per_doc,
            folder_id=rng.choice(folder_ids) if rng.random() < 0.7 else None,
        )
        documents.append(doc)
    db.add_all(documents)
    await db.flush()
    document_ids = [d.id for d in documents]

    for doc in documents:
        for j in range(n_chunks_per_doc):
            content = f"[{doc.title}] 청크 {j + 1}의 내용. {rng.choice(_CONCEPT_POOL)}에 관한 설명."
            all_chunks.append(
                Chunk(
                    document_id=doc.id,
                    index=j,
                    content=content,
                    content_hash=hashlib.sha256(content.encode()).hexdigest(),
                    token_count=len(content),
                )
            )
    db.add_all(all_chunks)
    await db.flush()

    # ── Quizzes + Items ──
    quizzes: list[Quiz] = []
    all_items: list[QuizItem] = []
    for doc in documents:
        for q_idx in range(n_quizzes_per_doc):
            quiz = Quiz(
                document_id=doc.id,
                title=f"{doc.title} 퀴즈 {q_idx + 1}",
                item_count=n_items_per_quiz,
            )
            quizzes.append(quiz)
    db.add_all(quizzes)
    await db.flush()
    quiz_ids = [q.id for q in quizzes]

    for quiz in quizzes:
        for k in range(n_items_per_quiz):
            qt = rng.choice(_QUIZ_TYPES)
            options = {"A": "옵션A", "B": "옵션B", "C": "옵션C", "D": "옵션D"} if qt == QuizType.MCQ else None
            correct = rng.choice(["A", "B", "C", "D"]) if qt == QuizType.MCQ else "정답"
            n_tags = rng.randint(1, 3)
            tags = rng.sample(_CONCEPT_POOL, n_tags)
            all_items.append(
                QuizItem(
                    quiz_id=quiz.id,
                    quiz_type=qt,
                    question=f"문제 {k + 1}: {tags[0]}에 대한 질문?",
                    correct_answer=correct,
                    explanation=f"{tags[0]}의 정의에 따르면...",
                    options=options,
                    concept_tags=tags,
                    difficulty=rng.randint(1, 3),
                )
            )
    db.add_all(all_items)
    await db.flush()
    item_ids = [it.id for it in all_items]

    # ── QuizAttempts ── (spread over 90 days)
    attempts: list[QuizAttempt] = []
    quiz_attempt_counters: dict[uuid.UUID, int] = {}
    for _ in range(n_attempts):
        quiz = rng.choice(quizzes)
        days_ago = rng.randint(0, 89)
        score = rng.randint(0, quiz.item_count)
        quiz_attempt_counters[quiz.id] = quiz_attempt_counters.get(quiz.id, 0) + 1
        attempts.append(
            QuizAttempt(
                quiz_id=quiz.id,
                user_id=user_id,
                attempt_number=quiz_attempt_counters[quiz.id],
                score=score,
                total=quiz.item_count,
                answers=[],
                created_at=now - timedelta(days=days_ago, hours=rng.randint(0, 23)),
            )
        )
    # Batch add
    for batch_start in range(0, len(attempts), 500):
        db.add_all(attempts[batch_start : batch_start + 500])
        await db.flush()
    attempt_ids = [a.id for a in attempts]

    # ── WrongAnswerNotes ── (unique per user+item, spread across items)
    used_item_ids: set[uuid.UUID] = set()
    wrong_notes: list[WrongAnswerNote] = []
    available_items = list(all_items)
    rng.shuffle(available_items)

    for item in available_items[:n_wrong_notes]:
        if item.id in used_item_ids:
            continue
        used_item_ids.add(item.id)
        is_mastered = rng.random() < 0.4
        days_until_review = rng.randint(-5, 14)
        wrong_notes.append(
            WrongAnswerNote(
                attempt_id=rng.choice(attempt_ids),
                user_id=user_id,
                quiz_item_id=item.id,
                user_answer="오답",
                correct_answer=item.correct_answer,
                wrong_reason=f"'{item.correct_answer}'가 정답이지만 '오답'이라고 답했습니다.",
                concept_tags=item.concept_tags,
                review_count=rng.randint(0, 10),
                consecutive_correct=rng.randint(5, 8) if is_mastered else rng.randint(0, 4),
                next_review_at=now + timedelta(days=days_until_review),
                is_mastered=is_mastered,
                ease_factor=round(rng.uniform(1.3, 3.0), 2),
                interval_days=rng.randint(1, 30),
            )
        )
    for batch_start in range(0, len(wrong_notes), 500):
        db.add_all(wrong_notes[batch_start : batch_start + 500])
        await db.flush()
    wrong_note_ids = [wn.id for wn in wrong_notes]

    return SeedResult(
        user_id=user_id,
        document_ids=document_ids,
        folder_ids=folder_ids,
        quiz_ids=quiz_ids,
        item_ids=item_ids,
        attempt_ids=attempt_ids,
        wrong_note_ids=wrong_note_ids,
    )
