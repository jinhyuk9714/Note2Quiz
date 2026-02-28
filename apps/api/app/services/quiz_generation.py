from __future__ import annotations

import asyncio
import json
import logging
import uuid

import anthropic
from anthropic.types import TextBlock
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.llm_client import (
    PROFILE_QUIZ_GENERATION,
    create_llm_client,
    get_circuit_breaker,
)
from app.models.chunk import Chunk
from app.models.quiz import Quiz, QuizItem, QuizType
from app.prompts.quiz_prompt import build_quiz_generation_prompt, validate_quiz_items

logger = logging.getLogger(__name__)


class NoChunksFoundError(ValueError):
    """Raised when no chunks are available for quiz generation."""


class NoGeneratedItemsError(RuntimeError):
    """Raised when quiz generation produced no items."""


async def load_chunks(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunk_ids: list[uuid.UUID] | None,
) -> list[Chunk]:
    """Load chunks for a document, optionally filtered by chunk IDs."""
    stmt = select(Chunk).where(Chunk.document_id == document_id)
    if chunk_ids:
        stmt = stmt.where(Chunk.id.in_(chunk_ids))
    stmt = stmt.order_by(Chunk.index)
    result = await db.execute(stmt)
    chunks = list(result.scalars().all())
    if not chunks:
        raise NoChunksFoundError("No chunks found for the given document/chunk IDs")
    return chunks


def _mock_quiz_items(n: int, quiz_types: list[str]) -> list[dict[str, object]]:
    """Return deterministic quiz items for E2E testing."""
    items: list[dict[str, object]] = []
    for i in range(n):
        qt = quiz_types[i % len(quiz_types)]
        if qt == "mcq":
            items.append(
                {
                    "quiz_type": "mcq",
                    "question": f"Mock Q{i + 1}: 다음 중 올바른 것은?",
                    "correct_answer": "A",
                    "explanation": f"A가 정답입니다. (Mock 해설 {i + 1})",
                    "options": {"A": "정답 선택지", "B": "오답 1", "C": "오답 2", "D": "오답 3"},
                    "concept_tags": ["mock-concept"],
                    "difficulty": 2,
                }
            )
        elif qt == "true_false":
            items.append(
                {
                    "quiz_type": "true_false",
                    "question": f"Mock TF{i + 1}: 지구는 둥글다.",
                    "correct_answer": "O",
                    "explanation": "지구는 대략적으로 구형입니다.",
                    "options": None,
                    "concept_tags": ["mock-concept"],
                    "difficulty": 1,
                }
            )
        elif qt == "short_answer":
            items.append(
                {
                    "quiz_type": "short_answer",
                    "question": f"Mock SA{i + 1}: 대한민국의 수도는?",
                    "correct_answer": "서울",
                    "explanation": "대한민국의 수도는 서울입니다.",
                    "options": None,
                    "concept_tags": ["mock-concept"],
                    "difficulty": 1,
                }
            )
        else:
            items.append(
                {
                    "quiz_type": "fill_blank",
                    "question": f"Mock FB{i + 1}: 대한민국의 수도는 ___이다.",
                    "correct_answer": "서울",
                    "explanation": "대한민국의 수도는 서울입니다.",
                    "options": None,
                    "concept_tags": ["mock-concept"],
                    "difficulty": 1,
                }
            )
    return items


async def generate_questions_for_chunk(
    client: anthropic.AsyncAnthropic,
    chunk: Chunk,
    questions_per_chunk: int,
    quiz_types: list[str],
    focus_concepts: list[str] | None = None,
    document_title: str | None = None,
    already_covered_concepts: list[str] | None = None,
) -> list[dict[str, object]]:
    """Call LLM for a single chunk and return parsed quiz items."""
    # E2E test mock: return deterministic items when using a test API key
    if settings.anthropic_api_key.startswith("test-"):
        items = _mock_quiz_items(questions_per_chunk, quiz_types)
        for item in items:
            item["source_chunk_id"] = str(chunk.id)
        return items

    prompt = build_quiz_generation_prompt(
        chunk_text=chunk.content,
        n_questions=questions_per_chunk,
        quiz_types=quiz_types,
        focus_concepts=focus_concepts,
        document_title=document_title,
        already_covered_concepts=already_covered_concepts,
    )
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    first_block = response.content[0]
    raw_text = first_block.text if isinstance(first_block, TextBlock) else ""
    parsed = _parse_quiz_json(raw_text)
    validated = validate_quiz_items(parsed, quiz_types)
    if len(validated) < len(parsed):
        logger.warning(
            "Chunk %s: %d/%d items dropped by validation",
            chunk.id,
            len(parsed) - len(validated),
            len(parsed),
        )
    for item_data in validated:
        item_data["source_chunk_id"] = str(chunk.id)
    return validated


async def save_quiz_to_db(
    db: AsyncSession,
    document_id: uuid.UUID,
    title: str,
    items_data: list[dict[str, object]],
    n_questions: int,
    quiz_types: list[str],
) -> Quiz:
    """Create Quiz + QuizItem rows from generated item data."""
    selected_items = items_data[:n_questions]
    if not selected_items:
        raise NoGeneratedItemsError("No generated quiz items to save")

    quiz = Quiz(
        document_id=document_id,
        title=title,
        item_count=0,
    )
    db.add(quiz)
    await db.flush()

    all_items: list[QuizItem] = []
    for idx, item_data in enumerate(selected_items):
        quiz_type_str = str(item_data.get("quiz_type", "mcq"))
        if quiz_type_str not in quiz_types:
            quiz_type_str = quiz_types[idx % len(quiz_types)]
        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=uuid.UUID(str(item_data["source_chunk_id"])),
            quiz_type=QuizType(quiz_type_str),
            question=str(item_data.get("question", "")),
            correct_answer=str(item_data.get("correct_answer", "")),
            explanation=str(item_data.get("explanation", "")),
            options=item_data.get("options"),  # type: ignore[arg-type]
            concept_tags=item_data.get("concept_tags", []),  # type: ignore[arg-type]
            difficulty=int(item_data.get("difficulty", 1)),  # type: ignore[arg-type]
        )
        db.add(item)
        all_items.append(item)

    quiz.item_count = len(all_items)
    return quiz


async def generate_quiz_from_chunks(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunk_ids: list[uuid.UUID] | None,
    n_questions: int,
    quiz_types: list[str],
    title: str,
    focus_concepts: list[str] | None = None,
    document_title: str | None = None,
) -> Quiz:
    chunks = await load_chunks(db, document_id, chunk_ids)
    logger.info(
        "Starting quiz generation: document=%s, n_questions=%d, types=%s, chunks=%d",
        document_id,
        n_questions,
        quiz_types,
        len(chunks),
    )

    client = create_llm_client(PROFILE_QUIZ_GENERATION)
    questions_per_chunk = max(1, n_questions // len(chunks))

    semaphore = asyncio.Semaphore(5)
    max_attempts = settings.llm_chunk_retry_attempts + 1

    async def _generate_with_limit(chunk: Chunk) -> list[dict[str, object]]:
        async with semaphore:
            last_exc: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    result = await generate_questions_for_chunk(
                        client,
                        chunk,
                        questions_per_chunk,
                        quiz_types,
                        focus_concepts=focus_concepts,
                        document_title=document_title,
                    )
                    get_circuit_breaker().record_success()
                    return result
                except Exception as exc:
                    last_exc = exc
                    get_circuit_breaker().record_failure()
                    if attempt < max_attempts - 1:
                        delay = 2**attempt
                        logger.warning(
                            "Chunk %s generation failed (attempt %d/%d), retrying in %ds: %s",
                            chunk.id,
                            attempt + 1,
                            max_attempts,
                            delay,
                            exc,
                        )
                        await asyncio.sleep(delay)
            raise last_exc  # type: ignore[misc]

    results = await asyncio.gather(
        *[_generate_with_limit(c) for c in chunks], return_exceptions=True
    )
    new_items_data: list[dict[str, object]] = []
    failed_chunks = 0
    for i, result in enumerate(results):
        if type(result) is not list:
            logger.error("Chunk %s failed after retries: %s", chunks[i].id, result)
            failed_chunks += 1
        else:
            new_items_data.extend(result)

    if failed_chunks == len(chunks):
        raise NoGeneratedItemsError("All chunks failed during quiz generation")
    if failed_chunks > 0:
        logger.warning(
            "%d/%d chunks failed; proceeding with %d items",
            failed_chunks,
            len(chunks),
            len(new_items_data),
        )
    if not new_items_data:
        raise NoGeneratedItemsError("Quiz generation produced no items")

    logger.info(
        "Quiz generation complete: %d items from %d chunks", len(new_items_data), len(chunks)
    )
    return await save_quiz_to_db(db, document_id, title, new_items_data, n_questions, quiz_types)


def _parse_quiz_json(raw_text: str) -> list[dict[str, object]]:
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]") + 1
        if start != -1 and end > start:
            data = json.loads(text[start:end])
        else:
            return []

    if isinstance(data, dict) and "questions" in data:
        return data["questions"]  # type: ignore[no-any-return]
    if isinstance(data, list):
        return data  # type: ignore[no-any-return]
    return []
