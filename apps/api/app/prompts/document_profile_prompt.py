from __future__ import annotations

import json


def build_document_profile_prompt(blocks: list[dict[str, str]]) -> str:
    """Build a prompt for LLM-based document profiling.

    Args:
        blocks: List of dicts with keys: block_id, heuristic_kind, text_preview.

    Returns:
        Prompt string requesting a DocumentProfile JSON response.
    """
    if not blocks:
        raise ValueError("blocks must not be empty")

    blocks_json = json.dumps(blocks, ensure_ascii=False, indent=2)

    return f"""You are a document analysis expert. Your task is to analyze the following text blocks from a document and determine:

1. **Document type**: What kind of document is this?
2. **Dominant language**: What is the primary language?
3. **Quizability**: How suitable is this document for generating quiz questions? (1=not at all, 5=excellent)
4. **Block classification**: Which blocks contain actual learning content worth quizzing, and which should be ignored?

Each block has a pre-assigned `heuristic_kind` from a rule-based classifier. You should use this as a hint but make your own judgment. Override the heuristic when appropriate.

**Document type options** (choose exactly one):
- "vocabulary_book" — word lists, vocabulary entries, expression lists
- "lecture_note" — class notes, lecture summaries
- "textbook_chapter" — textbook sections with structured content
- "slide_deck" — presentation slides
- "research_paper" — academic papers, theses
- "workbook" — exercise books, practice problems
- "article" — news articles, blog posts, essays
- "mixed" — unclear or mixed content types

**Block classification rules**:
- A block is "quizable" if it contains substantive learning content: definitions, concepts, facts, processes, comparisons, formulas, vocabulary, examples that teach something.
- A block should be "ignored" if it contains: table of contents, cover pages, copyright notices, instructions/study tips, references/bibliography, promotional content, answer keys, appendices, or low-value fragments.
- **Be conservative**: if a block is ambiguous, do NOT include it as quizable.
- If the document is clearly not study material (e.g., a product brochure, advertisement, manual), give a low quizability_score.

**Text blocks to analyze**:
{blocks_json}

**Output format**:
Return ONLY a valid JSON object (no markdown fences, no surrounding text) with this exact structure:
{{
  "document_type": "one of the types above",
  "dominant_language": "two-letter language code (e.g., ko, en, ja)",
  "quizability_score": 1-5,
  "quizable_block_ids": ["block_id_1", "block_id_2", ...],
  "ignored_block_ids": ["block_id_3", "block_id_4", ...],
  "rationale": "Brief explanation of your classification decisions"
}}

Return ONLY the JSON object."""
