from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import anthropic
from anthropic.types import TextBlock

from app.core.config import settings
from app.core.llm_client import get_circuit_breaker
from app.prompts.study_unit_prompt import build_study_unit_prompt
from app.schemas.document_analysis import (
    DocumentProfile,
    SourceBlock,
    StudyUnit,
    StudyUnitType,
)

logger = logging.getLogger(__name__)

# Max blocks to send in a single LLM call
_BATCH_SIZE = 8


async def extract_study_units(
    quizable_blocks: list[SourceBlock],
    profile: DocumentProfile,
    client: anthropic.AsyncAnthropic,
) -> list[StudyUnit]:
    """Extract StudyUnits from quizable blocks using LLM.

    Blocks are processed in batches to manage cost and context window.
    Uses semaphore + retry pattern consistent with quiz generation.
    """
    if not quizable_blocks:
        return []

    # Split blocks into batches
    batches: list[list[SourceBlock]] = []
    for i in range(0, len(quizable_blocks), _BATCH_SIZE):
        batches.append(quizable_blocks[i : i + _BATCH_SIZE])

    semaphore = asyncio.Semaphore(3)
    max_attempts = settings.llm_chunk_retry_attempts + 1

    async def _extract_batch(batch: list[SourceBlock]) -> list[StudyUnit]:
        async with semaphore:
            last_exc: Exception | None = None
            for attempt in range(max_attempts):
                try:
                    result = await _call_study_unit_llm(batch, profile, client)
                    get_circuit_breaker().record_success()
                    return result
                except Exception as exc:
                    last_exc = exc
                    get_circuit_breaker().record_failure()
                    if attempt < max_attempts - 1:
                        delay = 2**attempt
                        logger.warning(
                            "Study unit extraction batch failed (attempt %d/%d), retrying in %ds: %s",
                            attempt + 1,
                            max_attempts,
                            delay,
                            exc,
                        )
                        await asyncio.sleep(delay)
            raise last_exc  # type: ignore[misc]

    results = await asyncio.gather(
        *[_extract_batch(batch) for batch in batches], return_exceptions=True
    )

    all_units: list[StudyUnit] = []
    failed_batches = 0
    for i, result in enumerate(results):
        if isinstance(result, BaseException):
            logger.error("Study unit batch %d failed: %s", i, result)
            failed_batches += 1
        else:
            all_units.extend(result)

    if failed_batches > 0:
        logger.warning(
            "%d/%d study unit batches failed; proceeding with %d units",
            failed_batches,
            len(batches),
            len(all_units),
        )

    return all_units


async def _call_study_unit_llm(
    blocks: list[SourceBlock],
    profile: DocumentProfile,
    client: anthropic.AsyncAnthropic,
) -> list[StudyUnit]:
    """Call LLM to extract study units from a batch of blocks."""
    blocks_data: list[dict[str, str]] = [
        {
            "block_id": b.block_id,
            "chunk_id": str(b.chunk_id),
            "text": b.text,
        }
        for b in blocks
    ]

    prompt = build_study_unit_prompt(
        blocks=blocks_data,
        document_type=profile.document_type.value,
        language=profile.dominant_language,
    )

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )
    first_block = response.content[0]
    raw_text = first_block.text if isinstance(first_block, TextBlock) else ""

    return _parse_study_units(raw_text, blocks)


def _parse_study_units(
    raw_text: str,
    blocks: list[SourceBlock],
) -> list[StudyUnit]:
    """Parse LLM response into StudyUnit objects with safe fallbacks."""
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
            try:
                data = json.loads(text[start:end])
            except json.JSONDecodeError:
                return []
        else:
            return []

    if not isinstance(data, list):
        return []

    valid_block_ids = {b.block_id for b in blocks}
    block_chunk_map = {b.block_id: b.chunk_id for b in blocks}
    valid_unit_types = {t.value for t in StudyUnitType}

    units: list[StudyUnit] = []
    for raw_item in data:  # pyright: ignore[reportUnknownVariableType]
        if not isinstance(raw_item, dict):
            continue
        item: dict[str, Any] = raw_item  # pyright: ignore[reportUnknownVariableType]

        block_id: str = item.get("block_id", "")
        if block_id not in valid_block_ids:
            continue

        unit_type_str: str = item.get("unit_type", "")
        if unit_type_str not in valid_unit_types:
            continue

        title: str = item.get("title", "")
        content: str = item.get("content", "")
        if not title or not content:
            continue

        # Coerce quizworthiness
        try:
            quizworthiness = max(1, min(5, int(item.get("quizworthiness", 3))))
        except (TypeError, ValueError):
            quizworthiness = 3

        concept_tags: list[str] = item.get("concept_tags", [])  # pyright: ignore[reportAssignmentType]
        if not concept_tags:
            concept_tags = ["untagged"]
        concept_tags = concept_tags[:3]

        source_excerpt = str(item.get("source_excerpt", ""))[:100]

        # Use chunk_id from block mapping (more reliable than LLM output)
        chunk_id = block_chunk_map.get(str(block_id), uuid.UUID(int=0))

        unit_id: str = item.get("unit_id", f"unit-{block_id}-{len(units)}")

        units.append(
            StudyUnit(
                unit_id=str(unit_id),
                block_id=str(block_id),
                chunk_id=chunk_id,
                unit_type=StudyUnitType(unit_type_str),
                title=str(title),
                content=str(content),
                quizworthiness=quizworthiness,
                concept_tags=[str(t) for t in concept_tags],
                source_excerpt=source_excerpt,
            )
        )

    return units
