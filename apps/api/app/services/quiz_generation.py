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
    PROFILE_DOCUMENT_ANALYSIS,
    PROFILE_QUIZ_GENERATION,
    PROFILE_STUDY_UNIT_EXTRACTION,
    create_llm_client,
    get_circuit_breaker,
)
from app.models.chunk import Chunk
from app.models.quiz import Quiz, QuizItem, QuizType
from app.prompts.quiz_prompt import (
    build_quiz_generation_prompt,
    build_quiz_generation_prompt_from_units,
    validate_quiz_items,
    validate_quiz_items_from_units,
)
from app.schemas.document_analysis import DocumentProfile, StudyUnit
from app.services.document_profiler import chunks_to_source_blocks, profile_document
from app.services.study_unit_extractor import extract_study_units

logger = logging.getLogger(__name__)


class NoChunksFoundError(ValueError):
    """Raised when no chunks are available for quiz generation."""


class NoGeneratedItemsError(RuntimeError):
    """Raised when quiz generation produced no items."""


class InsufficientContentError(ValueError):
    """Raised when the document lacks sufficient quizable content."""


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

        # Resolve source_chunk_id from source_unit_ids or direct field
        source_chunk_id_raw = item_data.get("source_chunk_id")
        source_chunk_id: uuid.UUID | None = None
        if source_chunk_id_raw:
            try:
                source_chunk_id = uuid.UUID(str(source_chunk_id_raw))
            except ValueError:
                pass

        # Extract source_unit_ids if present
        source_unit_ids_raw: object = item_data.get("source_unit_ids", [])
        source_unit_ids: list[str] = []
        if isinstance(source_unit_ids_raw, list):
            source_unit_ids = [str(s) for s in source_unit_ids_raw]  # pyright: ignore[reportUnknownVariableType,reportUnknownArgumentType]

        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=source_chunk_id,
            quiz_type=QuizType(quiz_type_str),
            question=str(item_data.get("question", "")),
            correct_answer=str(item_data.get("correct_answer", "")),
            explanation=str(item_data.get("explanation", "")),
            options=item_data.get("options"),  # type: ignore[arg-type]
            concept_tags=item_data.get("concept_tags", []),  # type: ignore[arg-type]
            difficulty=int(item_data.get("difficulty", 1)),  # type: ignore[arg-type]
            source_unit_ids=source_unit_ids,
        )
        db.add(item)
        all_items.append(item)

    quiz.item_count = len(all_items)
    return quiz


# ---------------------------------------------------------------------------
# StudyUnit-based pipeline (new main path)
# ---------------------------------------------------------------------------


async def generate_quiz_with_analysis(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunk_ids: list[uuid.UUID] | None,
    n_questions: int,
    quiz_types: list[str],
    title: str,
    focus_concepts: list[str] | None = None,
    document_title: str | None = None,
) -> Quiz:
    """Generate quiz using document analysis pipeline.

    Pipeline: Chunks -> SourceBlocks -> DocumentProfile -> StudyUnits -> Quiz

    Falls back to legacy chunk-based generation for test API keys.
    """
    chunks = await load_chunks(db, document_id, chunk_ids)
    logger.info(
        "Starting analyzed quiz generation: document=%s, n_questions=%d, types=%s, chunks=%d",
        document_id,
        n_questions,
        quiz_types,
        len(chunks),
    )

    # Mock path: use legacy flow for test API keys
    if settings.anthropic_api_key.startswith("test-"):
        return await _generate_quiz_legacy(
            db, document_id, chunks, n_questions, quiz_types, title, focus_concepts, document_title
        )

    # Step 1: Convert chunks to source blocks with heuristic labels
    blocks = chunks_to_source_blocks(chunks)

    # Step 2: Profile the document (1 LLM call)
    analysis_client = create_llm_client(PROFILE_DOCUMENT_ANALYSIS)
    profile = await profile_document(blocks, analysis_client)
    logger.info(
        "Document profile: type=%s, language=%s, quizability=%d, quizable=%d, ignored=%d",
        profile.document_type.value,
        profile.dominant_language,
        profile.quizability_score,
        len(profile.quizable_block_ids),
        len(profile.ignored_block_ids),
    )

    # Step 3: Check quizability
    if profile.quizability_score < 2:
        raise InsufficientContentError(
            "이 문서에서는 퀴즈로 만들 만한 학습 콘텐츠를 충분히 찾지 못했습니다."
        )

    quizable_block_id_set = set(profile.quizable_block_ids)
    quizable_blocks = [b for b in blocks if b.block_id in quizable_block_id_set]
    if not quizable_blocks:
        raise InsufficientContentError(
            "이 문서에서는 퀴즈로 만들 만한 학습 콘텐츠를 충분히 찾지 못했습니다."
        )

    # Step 4: Extract study units from quizable blocks
    extraction_client = create_llm_client(PROFILE_STUDY_UNIT_EXTRACTION)
    all_units = await extract_study_units(quizable_blocks, profile, extraction_client)

    # Filter by quizworthiness
    quizworthy_units = [u for u in all_units if u.quizworthiness >= 3]
    if not quizworthy_units:
        raise InsufficientContentError(
            "이 문서에서는 퀴즈로 만들 만한 학습 콘텐츠를 충분히 찾지 못했습니다."
        )

    logger.info(
        "Study units: total=%d, quizworthy=%d",
        len(all_units),
        len(quizworthy_units),
    )

    # Step 5: Generate quiz from study units
    quiz_items = await _generate_quiz_from_units(
        quizworthy_units, n_questions, quiz_types, profile, focus_concepts
    )

    if not quiz_items:
        raise NoGeneratedItemsError("퀴즈 생성에 실패했습니다.")

    # Step 6: Save to DB
    return await save_quiz_to_db(db, document_id, title, quiz_items, n_questions, quiz_types)


async def _generate_quiz_from_units(
    units: list[StudyUnit],
    n_questions: int,
    quiz_types: list[str],
    profile: DocumentProfile,
    focus_concepts: list[str] | None,
) -> list[dict[str, object]]:
    """Generate quiz items from StudyUnits with batch processing."""

    # Build unit dicts for the prompt
    unit_dicts: list[dict[str, object]] = [
        {
            "unit_id": u.unit_id,
            "unit_type": u.unit_type.value,
            "title": u.title,
            "content": u.content,
            "concept_tags": u.concept_tags,
        }
        for u in units
    ]

    # Build unit lookup for chunk_id resolution
    unit_chunk_map = {u.unit_id: u.chunk_id for u in units}
    valid_unit_ids = {u.unit_id for u in units}

    # Split units into batches if too many
    batch_size = 15
    batches: list[list[dict[str, object]]] = []
    for i in range(0, len(unit_dicts), batch_size):
        batches.append(unit_dicts[i : i + batch_size])

    # Calculate questions per batch
    questions_per_batch = max(len(quiz_types), n_questions // max(1, len(batches)))

    client = create_llm_client(PROFILE_QUIZ_GENERATION)
    semaphore = asyncio.Semaphore(5)
    max_attempts = settings.llm_chunk_retry_attempts + 1

    async def _generate_batch(
        batch: list[dict[str, object]], batch_n: int
    ) -> list[dict[str, object]]:
        async with semaphore:
            last_exc: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    prompt = build_quiz_generation_prompt_from_units(
                        units=batch,
                        n_questions=batch_n,
                        quiz_types=quiz_types,
                        document_type=profile.document_type.value,
                        language=profile.dominant_language,
                        focus_concepts=focus_concepts,
                    )
                    response = await client.messages.create(
                        model=settings.anthropic_model,
                        max_tokens=4096,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    first_block = response.content[0]
                    raw_text = first_block.text if isinstance(first_block, TextBlock) else ""
                    parsed = _parse_quiz_json(raw_text)
                    validated = validate_quiz_items_from_units(parsed, quiz_types, valid_unit_ids)

                    # Add source_chunk_id from unit_chunk_map
                    for item_data in validated:
                        source_ids: object = item_data.get("source_unit_ids", [])
                        if isinstance(source_ids, list) and source_ids:
                            first_unit_id = str(source_ids[0])  # pyright: ignore[reportUnknownArgumentType]
                            chunk_id = unit_chunk_map.get(first_unit_id)
                            if chunk_id:
                                item_data["source_chunk_id"] = str(chunk_id)

                    get_circuit_breaker().record_success()
                    return validated
                except Exception as exc:
                    last_exc = exc
                    get_circuit_breaker().record_failure()
                    if attempt < max_attempts - 1:
                        delay = 2**attempt
                        logger.warning(
                            "Unit batch quiz generation failed (attempt %d/%d), retrying in %ds: %s",
                            attempt + 1,
                            max_attempts,
                            delay,
                            exc,
                        )
                        await asyncio.sleep(delay)
            raise last_exc  # type: ignore[misc]

    results = await asyncio.gather(
        *[_generate_batch(batch, questions_per_batch) for batch in batches],
        return_exceptions=True,
    )

    all_items: list[dict[str, object]] = []
    failed = 0
    for i, result in enumerate(results):
        if isinstance(result, BaseException):
            logger.error("Unit batch %d failed: %s", i, result)
            failed += 1
        else:
            all_items.extend(result)

    if failed > 0:
        logger.warning(
            "%d/%d unit batches failed; proceeding with %d items",
            failed,
            len(batches),
            len(all_items),
        )

    return all_items


async def _generate_quiz_legacy(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunks: list[Chunk],
    n_questions: int,
    quiz_types: list[str],
    title: str,
    focus_concepts: list[str] | None = None,
    document_title: str | None = None,
) -> Quiz:
    """Legacy chunk-based quiz generation (used for test API keys)."""
    client = create_llm_client(PROFILE_QUIZ_GENERATION)
    questions_per_chunk = max(len(quiz_types), n_questions // len(chunks))

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

    return await save_quiz_to_db(db, document_id, title, new_items_data, n_questions, quiz_types)


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
    """Main entry point for quiz generation.

    Uses the StudyUnit-based analysis pipeline for production,
    and falls back to legacy chunk-based generation for test API keys.
    """
    return await generate_quiz_with_analysis(
        db=db,
        document_id=document_id,
        chunk_ids=chunk_ids,
        n_questions=n_questions,
        quiz_types=quiz_types,
        title=title,
        focus_concepts=focus_concepts,
        document_title=document_title,
    )


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
