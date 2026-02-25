from __future__ import annotations

import json
import uuid

import anthropic
from anthropic.types import TextBlock
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.chunk import Chunk
from app.models.quiz import Quiz, QuizItem, QuizType
from app.prompts.quiz_prompt import build_quiz_generation_prompt


async def generate_quiz_from_chunks(
    db: AsyncSession,
    document_id: uuid.UUID,
    chunk_ids: list[uuid.UUID] | None,
    n_questions: int,
    quiz_types: list[str],
    title: str,
) -> Quiz:
    # 1. Load chunks
    stmt = select(Chunk).where(Chunk.document_id == document_id)
    if chunk_ids:
        stmt = stmt.where(Chunk.id.in_(chunk_ids))
    stmt = stmt.order_by(Chunk.index)
    result = await db.execute(stmt)
    chunks = list(result.scalars().all())

    if not chunks:
        raise ValueError("No chunks found for the given document/chunk IDs")

    # 2. Check cache: existing quiz items for these chunk hashes
    chunk_hashes = [c.content_hash for c in chunks]
    existing_items_stmt = (
        select(QuizItem)
        .where(QuizItem.source_chunk_id.isnot(None))
        .join(Chunk, QuizItem.source_chunk_id == Chunk.id)
        .where(Chunk.content_hash.in_(chunk_hashes))
        .options(selectinload(QuizItem.source_chunk))
    )
    existing_result = await db.execute(existing_items_stmt)
    cached_items = list(existing_result.scalars().all())

    # 3. Determine which chunks need generation
    cached_hashes: set[str] = set()
    for item in cached_items:
        if item.source_chunk is not None:
            cached_hashes.add(item.source_chunk.content_hash)
    chunks_to_generate = [c for c in chunks if c.content_hash not in cached_hashes]

    # 4. Generate for uncached chunks
    new_items_data: list[dict[str, object]] = []
    if chunks_to_generate:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        questions_per_chunk = max(1, n_questions // len(chunks))

        for chunk in chunks_to_generate:
            prompt = build_quiz_generation_prompt(
                chunk_text=chunk.content,
                n_questions=questions_per_chunk,
                quiz_types=quiz_types,
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
            new_items_data.extend(parsed)

    # 5. Create Quiz + QuizItems
    quiz = Quiz(
        document_id=document_id,
        title=title,
        item_count=0,
    )
    db.add(quiz)
    await db.flush()

    all_items: list[QuizItem] = []

    # Add cached items (clone into new quiz)
    for cached in cached_items[:n_questions]:
        item = QuizItem(
            quiz_id=quiz.id,
            source_chunk_id=cached.source_chunk_id,
            quiz_type=cached.quiz_type,
            question=cached.question,
            correct_answer=cached.correct_answer,
            explanation=cached.explanation,
            options=cached.options,
            concept_tags=cached.concept_tags,
            difficulty=cached.difficulty,
        )
        db.add(item)
        all_items.append(item)

    # Add newly generated items
    remaining = n_questions - len(all_items)
    for idx, item_data in enumerate(new_items_data[:remaining]):
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
