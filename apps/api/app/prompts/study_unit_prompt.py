from __future__ import annotations

import json


def build_study_unit_prompt(
    blocks: list[dict[str, str]],
    document_type: str,
    language: str,
) -> str:
    """Build a prompt for extracting StudyUnits from document blocks.

    Args:
        blocks: List of dicts with keys: block_id, chunk_id, text.
        document_type: The classified document type.
        language: The dominant language code.

    Returns:
        Prompt string requesting a StudyUnit JSON array response.
    """
    if not blocks:
        raise ValueError("blocks must not be empty")

    blocks_json = json.dumps(blocks, ensure_ascii=False, indent=2)

    type_guidance = _get_type_guidance(document_type)

    return f"""You are an expert study material analyzer. Extract discrete, quiz-worthy learning units from the text blocks below.

**Document type**: {document_type}
**Language**: {language}

{type_guidance}

**General rules**:
- Each study unit must represent exactly ONE learning point.
- Do NOT create units from OCR noise, document structure descriptions, metadata, or non-educational content.
- Assign a `quizworthiness` score (1-5) to each unit:
  - 1 = trivial or not worth quizzing
  - 2 = marginally useful
  - 3 = worth quizzing
  - 4 = important learning point
  - 5 = critical/must-know concept
- Include 1-3 `concept_tags` per unit — canonical concept keywords, not generic terms.
- Avoid generic tags like "introduction", "overview", "important", "example", "chapter".
- `source_excerpt` should be a short quote (max 100 chars) from the original text that supports the unit.
- `title` should be a concise name for the learning point (not a full sentence).
- `content` should contain the essential information needed to create a quiz question.

**Study unit types** (choose the most appropriate for each):
- "vocabulary_entry" — a word, term, or expression with its meaning
- "definition" — a formal definition of a concept
- "concept" — a conceptual idea or principle
- "comparison" — a distinction or comparison between two or more things
- "process" — a sequence of steps, workflow, or procedure
- "rule" — a rule, law, constraint, or condition
- "formula" — a mathematical formula, equation, or calculation method
- "claim" — a factual claim, finding, or conclusion
- "example" — an illustrative example that teaches a pattern or principle

**Text blocks**:
{blocks_json}

**Output format**:
Return ONLY a valid JSON array (no markdown fences, no surrounding text). Each item must have:
{{
  "unit_id": "unit-<block_id>-<sequential_number>",
  "block_id": "<the block_id this unit was extracted from>",
  "chunk_id": "<the chunk_id from the block>",
  "unit_type": "<one of the types above>",
  "title": "<concise title for the learning point>",
  "content": "<essential information for quiz creation>",
  "quizworthiness": 1-5,
  "concept_tags": ["tag1", "tag2"],
  "source_excerpt": "<short supporting quote from original text>"
}}

Return ONLY the JSON array."""


def _get_type_guidance(document_type: str) -> str:
    """Return extraction guidance specific to the document type."""
    guidance_map: dict[str, str] = {
        "vocabulary_book": (
            "**Vocabulary-specific guidance**:\n"
            "- Focus on individual words/expressions and their meanings.\n"
            "- Include usage notes, example sentences, synonyms, and confusable pairs.\n"
            "- Prefer `vocabulary_entry` type for most units.\n"
            "- Group related words only if they form a meaningful comparison."
        ),
        "lecture_note": (
            "**Lecture note guidance**:\n"
            "- Focus on definitions, core concepts, comparisons, and processes.\n"
            "- Extract key takeaways and important distinctions.\n"
            "- Prefer `definition`, `concept`, `comparison`, and `process` types."
        ),
        "textbook_chapter": (
            "**Textbook guidance**:\n"
            "- Focus on definitions, concepts, formulas, rules, and comparisons.\n"
            "- Extract structured knowledge: theorems, principles, conditions.\n"
            "- Prefer `definition`, `concept`, `formula`, `rule` types."
        ),
        "slide_deck": (
            "**Slide deck guidance**:\n"
            "- Focus on key points from each slide — definitions, concepts, comparisons.\n"
            "- Slides often have bullet points; extract the underlying concept.\n"
            "- Prefer `concept`, `definition`, `comparison` types."
        ),
        "research_paper": (
            "**Research paper guidance**:\n"
            "- Focus on: research purpose, hypothesis, methodology, key findings, interpretation, limitations.\n"
            "- Prefer `claim`, `concept`, `process`, `comparison` types.\n"
            "- Avoid extracting bibliographic references or author acknowledgments."
        ),
        "workbook": (
            "**Workbook guidance**:\n"
            "- Focus on rules, patterns, problem-solving procedures, and key examples.\n"
            "- Extract the underlying concept, not just the exercise text.\n"
            "- Prefer `rule`, `process`, `formula`, `example` types."
        ),
        "article": (
            "**Article guidance**:\n"
            "- Focus on key claims, arguments, evidence, and conclusions.\n"
            "- Prefer `claim`, `concept`, `comparison` types."
        ),
        "mixed": (
            "**Mixed document guidance**:\n"
            "- Extract only the most quiz-worthy canonical units.\n"
            "- Be selective — focus on clearly educational content.\n"
            "- Use whichever unit type best fits each learning point."
        ),
    }
    return guidance_map.get(document_type, guidance_map["mixed"])
