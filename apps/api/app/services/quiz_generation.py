from __future__ import annotations

import asyncio
import json
import uuid

import anthropic
from anthropic.types import TextBlock
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.chunk import Chunk
from app.models.quiz import Quiz, QuizItem, QuizType
from app.prompts.quiz_prompt import build_quiz_generation_prompt


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
        raise ValueError("No chunks found for the given document/chunk IDs")
    return chunks


async def generate_questions_for_chunk(
    client: anthropic.AsyncAnthropic,
    chunk: Chunk,
    questions_per_chunk: int,
    quiz_types: list[str],
    focus_concepts: list[str] | None = None,
) -> list[dict[str, object]]:
    """Call LLM for a single chunk and return parsed quiz items."""
    prompt = build_quiz_generation_prompt(
        chunk_text=chunk.content,
        n_questions=questions_per_chunk,
        quiz_types=quiz_types,
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
    for item_data in parsed:
        item_data["source_chunk_id"] = str(chunk.id)
    return parsed


async def save_quiz_to_db(
    db: AsyncSession,
    document_id: uuid.UUID,
    title: str,
    items_data: list[dict[str, object]],
    n_questions: int,
    quiz_types: list[str],
) -> Quiz:
    """Create Quiz + QuizItem rows from generated item data."""
    quiz = Quiz(
        document_id=document_id,
        title=title,
        item_count=0,
    )
    db.add(quiz)
    await db.flush()

    all_items: list[QuizItem] = []
    for idx, item_data in enumerate(items_data[:n_questions]):
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
) -> Quiz:
    chunks = await load_chunks(db, document_id, chunk_ids)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    questions_per_chunk = max(1, n_questions // len(chunks))

    semaphore = asyncio.Semaphore(5)

    async def _generate_with_limit(chunk: Chunk) -> list[dict[str, object]]:
        async with semaphore:
            return await generate_questions_for_chunk(
                client,
                chunk,
                questions_per_chunk,
                quiz_types,
                focus_concepts=focus_concepts,
            )

    results = await asyncio.gather(*[_generate_with_limit(c) for c in chunks])
    new_items_data: list[dict[str, object]] = []
    for items in results:
        new_items_data.extend(items)

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
