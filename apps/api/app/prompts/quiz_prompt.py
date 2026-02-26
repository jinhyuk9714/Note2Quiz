from __future__ import annotations


def build_quiz_generation_prompt(
    chunk_text: str,
    n_questions: int,
    quiz_types: list[str],
    focus_concepts: list[str] | None = None,
) -> str:
    types_str = ", ".join(quiz_types)

    # 유형별 개수 분배 지시
    per_type = n_questions // len(quiz_types)
    remainder = n_questions % len(quiz_types)
    distribution = f"Distribute EVENLY: approximately {per_type} questions per type"
    if remainder:
        distribution += f" (assign the extra {remainder} to any type)"

    focus_instruction = ""
    if focus_concepts:
        concepts_str = ", ".join(focus_concepts)
        focus_instruction = f"""
**FOCUS CONCEPTS**: You MUST prioritize generating questions about the following concepts: [{concepts_str}].
- At least 70% of the questions should directly test these concepts.
- Each generated question's concept_tags should include the relevant focus concept when applicable.
- If the study material does not cover these concepts, generate questions from whatever is available.
"""

    return f"""You are an expert educational quiz generator for university students.

Given the following study material, generate exactly {n_questions} quiz questions.

**Allowed question types**: {types_str}
{distribution}

**IMPORTANT**: You MUST use ALL of the allowed question types listed above. Do NOT generate only one type.
{focus_instruction}
Type-specific rules:
- "mcq": Multiple choice — include "options" with keys A, B, C, D. "correct_answer" is one of "A","B","C","D".
- "short_answer": Short answer — omit "options". "correct_answer" is a concise key phrase or short sentence (NOT a full explanation). Put detailed reasoning in "explanation".
- "true_false": True/False — omit "options". "question" is a declarative statement. "correct_answer" is "O" (true) or "X" (false).
- "fill_blank": Fill in the blank — omit "options". "question" contains "___" for the blank. "correct_answer" is the word/phrase for the blank.

**Study Material**:
{chunk_text}

**Output**: Return ONLY a JSON array. Examples of each type:
```json
[
  {{
    "quiz_type": "mcq",
    "question": "다음 중 올바른 것은?",
    "correct_answer": "A",
    "explanation": "A가 정답인 이유...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "concept_tags": ["개념1"],
    "difficulty": 2
  }},
  {{
    "quiz_type": "true_false",
    "question": "OO는 XX이다.",
    "correct_answer": "O",
    "explanation": "이 설명이 맞는 이유...",
    "concept_tags": ["개념2"],
    "difficulty": 1
  }},
  {{
    "quiz_type": "fill_blank",
    "question": "OO에서 사용하는 주요 기법은 ___이다.",
    "correct_answer": "YY",
    "explanation": "YY가 정답인 이유...",
    "concept_tags": ["개념3"],
    "difficulty": 2
  }},
  {{
    "quiz_type": "short_answer",
    "question": "OO의 주요 장점은 무엇인가?",
    "correct_answer": "AA와 BB",
    "explanation": "OO는 AA를 통해 효율을 높이고, BB로 안정성을 확보합니다.",
    "concept_tags": ["개념4"],
    "difficulty": 3
  }}
]
```

difficulty: 1 = easy, 2 = medium, 3 = hard.
concept_tags: 1-3 key concept keywords from the material.
explanation: 1-2 sentences explaining why the answer is correct.

**Language**: Generate ALL content (question, correct_answer, explanation, options, concept_tags) in the SAME language as the study material.

Return ONLY the JSON array, no other text."""
