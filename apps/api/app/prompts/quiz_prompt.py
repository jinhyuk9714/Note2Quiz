from __future__ import annotations


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
