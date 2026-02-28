from __future__ import annotations

import json
import logging
import re
from typing import Any

import anthropic
from anthropic.types import TextBlock

from app.core.config import settings
from app.models.chunk import Chunk
from app.prompts.document_profile_prompt import build_document_profile_prompt
from app.schemas.document_analysis import (
    BlockKind,
    DocumentProfile,
    DocumentType,
    SourceBlock,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Heuristic patterns (Korean / English / Japanese)
# ---------------------------------------------------------------------------

_TOC_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:table\s+of\s+contents|contents)\b"
    r"|목\s*차|차\s*례"
    r"|目次"
    r")",
)

_INSTRUCTION_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:how\s+to\s+use|study\s+tips?|study\s+guide|instructions?|directions?)\b"
    r"|사용\s*(?:방법|법)|학습\s*(?:방법|법|가이드)|공부\s*(?:방법|법)"
    r"|이용\s*(?:방법|안내)"
    r"|使い方|学習(?:方法|ガイド)"
    r")",
)

_REFERENCE_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:references?|bibliography|works?\s+cited|citations?)\b"
    r"|참고\s*문헌|참고\s*자료|출처"
    r"|参考文献"
    r")",
)

_ANSWER_KEY_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:answer\s+key|solutions?|answers?)\b"
    r"|정\s*답|해\s*설|풀\s*이"
    r"|解答|解説"
    r")",
)

_COVER_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:copyright|isbn|all\s+rights?\s+reserved|published\s+by|publisher)\b"
    r"|저작권|저자|발행|출판|판권"
    r"|著作権|出版|発行"
    r")",
)

_PROMO_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:free\s+(?:download|access)|subscribe|contact\s+us|visit\s+(?:us|our))\b"
    r"|무료\s*(?:제공|다운|배포)|문의|수강\s*(?:생|신청|안내)"
    r"|(?:https?://|www\.)"
    r"|blog\.[a-z]|\.com/|\.co\.kr"
    r")",
)

_APPENDIX_PATTERN = re.compile(
    r"(?i)(?:"
    r"\b(?:appendix|appendices)\b"
    r"|부록|별첨"
    r"|付録"
    r")",
)


def classify_block_heuristic(text: str) -> BlockKind:
    """Classify a text block using rule-based heuristics.

    This is a *prior* for the LLM profiler, not a final decision.
    """
    stripped = text.strip()

    # Too short — likely noise or fragment
    if len(stripped) < 30:
        return BlockKind.LOW_VALUE

    # Check first N characters for structural cues (before OCR noise check,
    # because TOCs/references often have dots/numbers that lower the ratio)
    head = stripped[:300]

    if _TOC_PATTERN.search(head):
        return BlockKind.TABLE_OF_CONTENTS
    if _ANSWER_KEY_PATTERN.search(head):
        return BlockKind.ANSWER_KEY
    if _INSTRUCTION_PATTERN.search(head):
        return BlockKind.INSTRUCTION
    if _APPENDIX_PATTERN.search(head):
        return BlockKind.APPENDIX

    # These patterns can appear anywhere in the block
    if _COVER_PATTERN.search(stripped):
        cover_matches = len(_COVER_PATTERN.findall(stripped))
        if cover_matches >= 2:
            return BlockKind.COVER

    if _REFERENCE_PATTERN.search(head):
        return BlockKind.REFERENCE

    if _PROMO_PATTERN.search(stripped):
        promo_matches = len(_PROMO_PATTERN.findall(stripped))
        if promo_matches >= 2:
            return BlockKind.PROMO

    # OCR noise: high ratio of non-alphanumeric / non-hangul characters
    total_chars = len(stripped)
    meaningful = len(
        re.findall(r"[\w\u3131-\u318E\uAC00-\uD7A3\u3040-\u30FF\u4E00-\u9FFF]", stripped)
    )
    if total_chars > 0 and meaningful / total_chars < 0.4:
        return BlockKind.LOW_VALUE

    return BlockKind.LEARNING_CONTENT


def chunks_to_source_blocks(chunks: list[Chunk]) -> list[SourceBlock]:
    """Convert Chunk ORM objects to SourceBlock analysis objects."""
    blocks: list[SourceBlock] = []
    for chunk in chunks:
        block_id = f"blk-{str(chunk.id)[:8]}-{chunk.index}"
        kind = classify_block_heuristic(chunk.content)
        blocks.append(
            SourceBlock(
                block_id=block_id,
                chunk_id=chunk.id,
                index=chunk.index,
                origin=f"chunk-{chunk.index}",
                text=chunk.content,
                heuristic_kind=kind,
            )
        )
    return blocks


async def profile_document(
    blocks: list[SourceBlock],
    client: anthropic.AsyncAnthropic,
) -> DocumentProfile:
    """Profile a document by sending block previews to the LLM.

    Returns a DocumentProfile that classifies blocks as quizable or ignored.
    """
    # Build preview — only send first 200 chars of each block
    blocks_preview: list[dict[str, str]] = [
        {
            "block_id": b.block_id,
            "heuristic_kind": b.heuristic_kind.value,
            "text_preview": b.text[:200],
        }
        for b in blocks
    ]

    prompt = build_document_profile_prompt(blocks_preview)
    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    first_block = response.content[0]
    raw_text = first_block.text if isinstance(first_block, TextBlock) else ""

    return _parse_document_profile(raw_text, blocks)


def _parse_document_profile(
    raw_text: str,
    blocks: list[SourceBlock],
) -> DocumentProfile:
    """Parse LLM response into DocumentProfile, with safe fallbacks."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]

    data: dict[str, Any]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end > start:
            try:
                data = json.loads(text[start:end])
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}

    # Validate and coerce
    all_block_ids = {b.block_id for b in blocks}
    try:
        doc_type = DocumentType(str(data.get("document_type", "mixed")))
    except ValueError:
        doc_type = DocumentType.MIXED

    dominant_language = str(data.get("dominant_language", "ko"))
    score_raw: Any = data.get("quizability_score", 3)
    try:
        score = max(1, min(5, int(score_raw)))
    except (TypeError, ValueError):
        score = 3

    quizable_raw: list[Any] = data.get("quizable_block_ids", [])
    quizable_ids: list[str] = [str(bid) for bid in quizable_raw if bid in all_block_ids]
    ignored_raw: list[Any] = data.get("ignored_block_ids", [])
    ignored_ids: list[str] = [str(bid) for bid in ignored_raw if bid in all_block_ids]
    rationale = str(data.get("rationale", ""))

    # If LLM returned nothing useful, fall back to heuristic
    if not quizable_ids and not ignored_ids:
        quizable_ids = [
            b.block_id for b in blocks if b.heuristic_kind == BlockKind.LEARNING_CONTENT
        ]
        ignored_ids = [b.block_id for b in blocks if b.heuristic_kind != BlockKind.LEARNING_CONTENT]
        rationale = "Fallback: LLM response was empty; used heuristic classification."

    return DocumentProfile(
        document_type=doc_type,
        dominant_language=dominant_language,
        quizability_score=score,
        quizable_block_ids=quizable_ids,
        ignored_block_ids=ignored_ids,
        rationale=rationale,
    )
