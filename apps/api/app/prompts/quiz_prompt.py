from __future__ import annotations

import json
import re
import unicodedata
from typing import cast


def build_quiz_generation_prompt(
    chunk_text: str,
    n_questions: int,
    quiz_types: list[str],
    focus_concepts: list[str] | None = None,
    document_title: str | None = None,
    section_title: str | None = None,
    global_summary: str | None = None,
    already_covered_concepts: list[str] | None = None,
) -> str:
    if not chunk_text.strip():
        raise ValueError("chunk_text must not be empty")

    if not quiz_types:
        raise ValueError("quiz_types must not be empty")

    if n_questions <= 0:
        raise ValueError("n_questions must be > 0")

    if n_questions < len(quiz_types):
        raise ValueError(
            "n_questions must be >= len(quiz_types) because every allowed quiz type must appear at least once"
        )

    types_str = ", ".join(quiz_types)
    types_literal = ", ".join(f'"{qt}"' for qt in quiz_types)

    per_type = n_questions // len(quiz_types)
    remainder = n_questions % len(quiz_types)

    distribution = (
        f"- Use every allowed question type at least once.\n"
        f"- Target an even distribution: about {per_type} questions per type"
    )
    if remainder:
        distribution += f", assigning the extra {remainder} question(s) to any type."
    else:
        distribution += "."

    context_lines: list[str] = []
    if document_title:
        context_lines.append(f"- Document title: {document_title}")
    if section_title:
        context_lines.append(f"- Current section: {section_title}")
    if global_summary:
        context_lines.append(f"- Whole-document summary: {global_summary}")
    if already_covered_concepts:
        context_lines.append("- Already covered concepts: " + ", ".join(already_covered_concepts))

    context_block = ""
    if context_lines:
        context_block = "**Global context**\n" + "\n".join(context_lines) + "\n"

    focus_block = ""
    if focus_concepts:
        focus_block = (
            "**Focus concepts**\n"
            f"- Prioritize these concepts whenever the study material genuinely supports them: [{', '.join(focus_concepts)}]\n"
            "- Aim for at least 70% of the questions to directly test these concepts when feasible.\n"
            "- If a focus concept is used, include that exact concept in `concept_tags`.\n"
            "- If the material does not clearly support a focus concept, do NOT force it.\n"
        )

    return f"""You are an expert university-level instructional designer and quiz writer.

Generate exactly {n_questions} quiz questions from the study material.

**Allowed quiz types**: {types_str}
{distribution}

**Primary goal**
Create only high-value, study-worthy questions that help a university student review the most important ideas efficiently.

**Non-negotiable rules**
- Use the study material as the ONLY source of truth.
- Do NOT use outside knowledge.
- Do NOT invent facts, fill gaps, or infer unsupported details.
- Every question must be clearly answerable from the study material.
- Silently analyze the material first, then output ONLY the final JSON array.

{context_block}{focus_block}**What to quiz**
Prioritize questions about:
- key definitions and essential terminology
- core concepts and relationships between concepts
- mechanisms, causes, effects, and reasoning
- processes, workflows, algorithms, and step order
- comparisons, distinctions, and trade-offs
- assumptions, conditions, exceptions, and limitations
- practical applications, interpretations, or meaning
- ideas emphasized or repeated in the material
- confusion-prone points or likely misconceptions, but only when supported by the material

**What to ignore**
Never generate questions from:
- title pages, cover pages, section headers by themselves
- table of contents, agenda slides, roadmap slides
- introductory or motivational text that does not teach substantive content
- course logistics, schedules, announcements, submission instructions
- references, bibliography, citations, URLs, footnotes
- page numbers, headers, footers, watermarks, logos, copyright notices
- OCR noise, broken fragments, duplicated lines, malformed text
- decorative anecdotes or superficial examples
- bibliographic metadata unless it is explicitly part of the study content
- figure labels or captions unless they contain important conceptual information

**How to use examples, formulas, tables, diagrams, or code**
- Use them only when they teach a core concept, mechanism, comparison, condition, or application.
- Do NOT ask about superficial details.
- For formulas or code, prefer conceptual meaning, variable roles, conditions, or interpretation rather than raw copying, unless the exact expression itself is a key learning target.
- For code snippets: ask about what the code does, its time/space complexity, edge cases, or the purpose of a specific construct — not line-by-line memorization.
- For mathematical formulas: ask about what each variable represents, when the formula applies, its assumptions, or how changing a parameter affects the result.
- For tables or comparison charts: ask about differences, trade-offs, or patterns across rows/columns — not individual cell values unless they represent a key concept.
- For diagrams or flowcharts: ask about the overall process, decision points, or relationships — not visual layout details.

**Question quality rules**
- Each question must test ONE clear learning point.
- Prefer understanding, distinction, reasoning, and application over verbatim recall.
- Do NOT copy source sentences unless a precise technical term must be preserved.
- Make each question self-contained. Do NOT refer to "the figure above", "the previous section", "this slide", or similar context-dependent wording.
- Avoid near-duplicate questions.
- Avoid testing the same idea repeatedly with only minor wording changes.
- Cover the most important subtopics in this material as evenly as possible.
- If the material is narrow, ask different meaningful angles about the same supported concept instead of inventing unsupported facts.

**Difficulty**
- 1 = direct definition, basic recall, straightforward identification
- 2 = comparison, relation, explanation, or basic application
- 3 = inference, exception handling, condition-based reasoning, or deeper application
Use a balanced difficulty mix when feasible.

**Type-specific rules**
- "mcq":
  - Include "options" with keys A, B, C, D.
  - "correct_answer" must be exactly one of "A", "B", "C", or "D".
  - There must be exactly ONE correct option.
  - Distractors must be plausible and belong to the same semantic category as the correct answer.
  - Avoid joke answers, obviously wrong distractors, "all of the above", "none of the above", and trick-question formats.

- "short_answer":
  - Omit "options".
  - "correct_answer" must be a concise, objectively gradable key phrase or short sentence.
  - Do NOT make essay-style questions.
  - Put reasoning in "explanation", not in "correct_answer".

- "true_false":
  - Omit "options".
  - "question" must be a declarative statement.
  - "correct_answer" must be "O" for true or "X" for false.
  - Keep the statement unambiguous and focused on a single claim.
  - Avoid double negatives and confusing wording.

- "fill_blank":
  - Omit "options".
  - "question" must contain exactly one blank written as "___".
  - The blank should target a key term, concept, or short phrase.
  - "correct_answer" must be the word or phrase that fills the blank.
  - Do NOT create blanks whose answer is too long or vague to grade reliably.

**Tagging rules**
- "concept_tags" must contain 1 to 3 canonical concept keywords from the material.
- Use concise concept names, not full sentences.
- Avoid generic tags like "introduction", "overview", "important", "example", or "chapter".
- If a focus concept is relevant, include that exact concept tag.
- If global context is provided, use it to avoid repeating concepts already covered earlier.

**Explanation rules**
- "explanation" must be 1 to 2 sentences.
- Briefly explain why the answer is correct based only on the study material.
- Keep it concise but informative.

**Output format**
Return ONLY a valid JSON array.
Do NOT wrap it in markdown fences.
Do NOT include any text before or after the JSON.

Each item must contain:
- "quiz_type": one of {types_literal}
- "question": string
- "correct_answer": string
- "explanation": string
- "concept_tags": array of 1 to 3 strings
- "difficulty": integer 1, 2, or 3
- "options": required ONLY when quiz_type == "mcq"
- "options" must be omitted for all non-mcq questions

**Language**
Generate ALL content in the SAME language as the study material.
If the material is mixed-language, use the dominant language of the material.
Preserve technical terms in their original form when that improves correctness.

**Study material**
{chunk_text}

Return ONLY the JSON array."""


_VALID_DIFFICULTIES = {1, 2, 3}
_MCQ_KEYS = {"A", "B", "C", "D"}


def validate_quiz_items(
    items: list[dict[str, object]],
    allowed_types: list[str],
) -> list[dict[str, object]]:
    """Validate and filter LLM-generated quiz items.

    Returns only items that pass all checks. Invalid items are silently dropped.
    """
    valid: list[dict[str, object]] = []
    allowed_set = set(allowed_types)

    for item in items:
        quiz_type = item.get("quiz_type")
        if quiz_type not in allowed_set:
            continue

        question = item.get("question")
        if not isinstance(question, str) or not question.strip():
            continue

        correct_answer = item.get("correct_answer")
        if not isinstance(correct_answer, str) or not correct_answer.strip():
            continue

        explanation = item.get("explanation")
        if not isinstance(explanation, str) or not explanation.strip():
            continue

        difficulty = item.get("difficulty")
        if difficulty not in _VALID_DIFFICULTIES:
            # Try coercing
            try:
                difficulty = int(difficulty)  # type: ignore[arg-type]
            except (TypeError, ValueError):
                difficulty = 2
            if difficulty not in _VALID_DIFFICULTIES:
                difficulty = 2
            item["difficulty"] = difficulty

        concept_tags = item.get("concept_tags")
        if not isinstance(concept_tags, list) or len(cast(list[object], concept_tags)) == 0:
            continue
        if len(cast(list[object], concept_tags)) > 3:
            item["concept_tags"] = concept_tags[:3]

        # MCQ-specific: must have valid options
        if quiz_type == "mcq":
            options = item.get("options")
            if not isinstance(options, dict):
                continue
            if set(cast(dict[str, object], options).keys()) != _MCQ_KEYS:
                continue
            if correct_answer not in _MCQ_KEYS:
                continue
        else:
            # Non-MCQ should not have options (or options should be None/omitted)
            options = item.get("options")
            if options is not None:
                item["options"] = None

        # true_false: answer must be O or X
        if quiz_type == "true_false" and correct_answer not in ("O", "X"):
            continue

        # fill_blank: question must contain ___
        if quiz_type == "fill_blank" and "___" not in str(question):
            continue

        valid.append(item)

    return valid


# ---------------------------------------------------------------------------
# StudyUnit-based quiz generation prompt
# ---------------------------------------------------------------------------

_DOCUMENT_TYPE_STRATEGIES: dict[str, str] = {
    "vocabulary_book": (
        "- Prioritize meaning recall, usage distinction, and confusable pair differentiation.\n"
        "- Avoid asking only 'what does X mean?' — also test usage, collocations, and nuance."
    ),
    "lecture_note": (
        "- Focus on conceptual understanding, cause-effect, and comparison.\n"
        "- Prefer application and distinction over verbatim recall."
    ),
    "textbook_chapter": (
        "- Test definitions, theorem conditions, formula applications, and concept relationships.\n"
        "- Use difficulty 2-3 questions that require understanding, not just memorization."
    ),
    "slide_deck": (
        "- Extract the underlying concept from bullet points.\n"
        "- Prefer understanding and application over slide-specific wording."
    ),
    "research_paper": (
        "- Focus on research purpose, methodology rationale, key findings, and interpretation.\n"
        "- Avoid asking about author names or publication metadata."
    ),
    "workbook": (
        "- Focus on problem-solving rules, patterns, and procedures.\n"
        "- Test the underlying principle, not just the specific exercise answer."
    ),
    "article": (
        "- Focus on key claims, arguments, evidence, and conclusions.\n"
        "- Test critical reading and interpretation."
    ),
    "mixed": (
        "- Focus on the most educationally valuable content.\n"
        "- Be selective — only create questions that genuinely test learning."
    ),
}


def build_quiz_generation_prompt_from_units(
    units: list[dict[str, object]],
    n_questions: int,
    quiz_types: list[str],
    document_type: str,
    language: str,
    focus_concepts: list[str] | None = None,
) -> str:
    """Build quiz generation prompt from pre-extracted StudyUnits.

    Args:
        units: List of StudyUnit dicts (unit_id, unit_type, title, content, concept_tags).
        n_questions: Number of questions to generate.
        quiz_types: Allowed quiz types.
        document_type: Classified document type.
        language: Dominant language code.
        focus_concepts: Optional focus concepts.

    Returns:
        Prompt string for LLM quiz generation.
    """
    if not units:
        raise ValueError("units must not be empty")
    if not quiz_types:
        raise ValueError("quiz_types must not be empty")
    if n_questions <= 0:
        raise ValueError("n_questions must be > 0")
    if n_questions < len(quiz_types):
        raise ValueError(
            "n_questions must be >= len(quiz_types) because every allowed quiz type must appear at least once"
        )

    types_str = ", ".join(quiz_types)
    types_literal = ", ".join(f'"{qt}"' for qt in quiz_types)

    per_type = n_questions // len(quiz_types)
    remainder = n_questions % len(quiz_types)
    distribution = (
        f"- Use every allowed question type at least once.\n"
        f"- Target an even distribution: about {per_type} questions per type"
    )
    if remainder:
        distribution += f", assigning the extra {remainder} question(s) to any type."
    else:
        distribution += "."

    strategy = _DOCUMENT_TYPE_STRATEGIES.get(document_type, _DOCUMENT_TYPE_STRATEGIES["mixed"])

    focus_block = ""
    if focus_concepts:
        focus_block = (
            "**Focus concepts**\n"
            f"- Prioritize: [{', '.join(focus_concepts)}]\n"
            "- Aim for at least 70% of questions to test these concepts when feasible.\n\n"
        )

    units_json = json.dumps(units, ensure_ascii=False, indent=2)

    return f"""You are an expert university-level instructional designer and quiz writer.

Generate exactly {n_questions} quiz questions from the study units below.
Each study unit represents a pre-extracted, verified learning point from a {document_type} document.

**Allowed quiz types**: {types_str}
{distribution}

**Document type**: {document_type}
**Document type strategy**:
{strategy}

{focus_block}**CRITICAL RULES — NEVER violate these**:
- Each question MUST be based on one or more specific study units.
- You MUST include "source_unit_ids" in each question — a list of unit_id values that the question is based on.
- A question with empty or missing "source_unit_ids" is INVALID.
- Do NOT create questions about:
  - Document introduction, structure, or organization
  - How to use the document or study tips
  - Table of contents, part sizes, coverage percentages
  - Author comments, publisher information, or promotional content
  - References, bibliography, URLs, or copyright
  - Statistics about the document itself (e.g., "how many chapters")
- Do NOT ask "what is this document about" or "how is this document organized"
- EVERY question must test actual learning content with real educational value

**Question quality rules**
- Each question must test ONE clear learning point.
- Prefer understanding, distinction, reasoning, and application over verbatim recall.
- Make each question self-contained.
- Avoid near-duplicate questions.
- Cover different study units as evenly as possible.

**Difficulty**: 1=recall, 2=comparison/application, 3=inference/reasoning. Use a balanced mix.

**Type-specific rules**
- "mcq": options A/B/C/D, exactly one correct, plausible distractors
- "short_answer": concise key phrase answer, no essays
- "true_false": declarative statement, answer "O" or "X"
- "fill_blank": exactly one "___" blank, answer is term/phrase

**Tagging**: 1-3 canonical concept tags per question. No generic tags (introduction, overview, chapter, important).

**Explanation**: 1-2 sentences, based only on the study material.

**Language**: Generate ALL content in {language}. Preserve technical terms in original form when appropriate.

**Output format**
Return ONLY a valid JSON array (no markdown fences, no surrounding text).
Each item must contain:
- "quiz_type": one of {types_literal}
- "question": string
- "correct_answer": string
- "explanation": string
- "concept_tags": array of 1-3 strings
- "difficulty": integer 1, 2, or 3
- "options": required ONLY when quiz_type == "mcq" (keys A, B, C, D)
- "source_unit_ids": array of unit_id strings that this question is based on (REQUIRED, must not be empty)

**Study units**
{units_json}

Return ONLY the JSON array."""


# ---------------------------------------------------------------------------
# Enhanced validator for StudyUnit-based quiz items
# ---------------------------------------------------------------------------

_META_QUESTION_PATTERNS = re.compile(
    r"(?i)(?:"
    r"\b(?:table\s+of\s+contents|how\s+to\s+use|study\s+tips?|study\s+guide"
    r"|references?\b|bibliography|copyright|isbn|appendix|appendices)"
    r"|목\s*차|차\s*례|사용\s*방법|학습\s*(?:방법|법)|공부\s*(?:방법|법)"
    r"|참고\s*문헌|저작권|부록|정답\s*(?:지|표)"
    r"|how\s+(?:many|much)\s+(?:chapters?|sections?|parts?|pages?)"
    r"|(?:https?://|www\.)|blog\.|\.com/"
    r")",
)

_GENERIC_TAGS = frozenset(
    {
        "introduction",
        "overview",
        "chapter",
        "important",
        "example",
        "section",
        "summary",
        "review",
        "소개",
        "개요",
        "중요",
        "예시",
        "요약",
    }
)


def _normalize_question_for_dedup(question: str) -> str:
    """Normalize a question for deduplication comparison."""
    text = unicodedata.normalize("NFC", question.lower().strip())
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s]", "", text)
    return text


def validate_quiz_items_from_units(
    items: list[dict[str, object]],
    allowed_types: list[str],
    valid_unit_ids: set[str],
) -> list[dict[str, object]]:
    """Validate and filter quiz items generated from StudyUnits.

    Extends base validation with:
    - source_unit_ids presence and validity checking
    - Meta-question pattern rejection
    - Question deduplication
    - Generic concept tag filtering
    """
    # First pass: base validation
    base_valid = validate_quiz_items(items, allowed_types)

    valid: list[dict[str, object]] = []
    seen_questions: set[str] = set()

    for item in base_valid:
        # source_unit_ids must be present and non-empty
        source_ids = item.get("source_unit_ids")
        if not isinstance(source_ids, list) or not source_ids:
            continue

        # All referenced unit IDs must exist
        source_id_strs = [str(sid) for sid in cast(list[object], source_ids)]
        if not all(sid in valid_unit_ids for sid in source_id_strs):
            continue
        item["source_unit_ids"] = source_id_strs

        # Reject meta-questions
        question = str(item.get("question", ""))
        explanation = str(item.get("explanation", ""))
        combined_text = question + " " + explanation
        if _META_QUESTION_PATTERNS.search(combined_text):
            continue

        # Deduplicate by normalized question
        norm_q = _normalize_question_for_dedup(question)
        if norm_q in seen_questions:
            continue
        seen_questions.add(norm_q)

        # Filter generic concept tags
        concept_tags = item.get("concept_tags", [])
        if isinstance(concept_tags, list):
            tags_list = cast(list[object], concept_tags)
            filtered_tags = [
                t for t in tags_list if isinstance(t, str) and t.lower() not in _GENERIC_TAGS
            ]
            if not filtered_tags:
                # If all tags are generic, keep original (don't drop the item)
                filtered_tags = cast(list[str], concept_tags[:1])
            item["concept_tags"] = filtered_tags[:3]

        valid.append(item)

    return valid
