from __future__ import annotations

import json
import logging

import anthropic
from anthropic.types import TextBlock

from app.core.config import settings
from app.prompts.grading_prompt import build_semantic_grading_prompt

logger = logging.getLogger(__name__)


async def grade_answers_semantically(
    items: list[dict[str, str]],
) -> dict[str, bool]:
    """Call Claude API to semantically grade a batch of answers.

    Args:
        items: List of dicts with keys: id, question, correct_answer, user_answer.

    Returns:
        Dict mapping item id -> is_correct.
        Returns empty dict on API failure (caller falls back to exact match).
    """
    if not items:
        return {}

    logger.info("Semantic grading batch: %d items", len(items))
    prompt = build_semantic_grading_prompt(items)

    try:
        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )

        first_block = response.content[0]
        raw_text = first_block.text if isinstance(first_block, TextBlock) else ""
        return parse_grading_response(raw_text)

    except Exception:
        logger.exception("Semantic grading API call failed; falling back to exact match")
        return {}


def _parse_json_array(raw_text: str) -> list[dict[str, object]]:
    """Parse raw text into a JSON array of dicts (defensive)."""
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

    if isinstance(data, list):
        return data  # type: ignore[no-any-return]
    return []


def parse_grading_response(raw_text: str) -> dict[str, bool]:
    """Parse the JSON array from the Claude grading response."""
    entries = _parse_json_array(raw_text)
    result: dict[str, bool] = {}
    for entry in entries:
        entry_id = entry.get("id")
        entry_correct = entry.get("is_correct")
        if isinstance(entry_id, str) and isinstance(entry_correct, bool):
            result[entry_id] = entry_correct
    return result
