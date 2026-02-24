from __future__ import annotations


def build_quiz_generation_prompt(
    chunk_text: str,
    n_questions: int,
    quiz_types: list[str],
) -> str:
    types_str = ", ".join(quiz_types)
    return f"""You are an expert educational quiz generator for university students.

Given the following study material, generate exactly {n_questions} quiz questions.

**Allowed question types**: {types_str}
- "mcq": Multiple choice with 4 options (A, B, C, D)
- "short_answer": Short answer (1-2 sentences)
- "true_false": True/False statement
- "fill_blank": Fill in the blank

**Study Material**:
{chunk_text}

**Output**: Return ONLY a JSON array. Each element must have this structure:
```json
[
  {{
    "quiz_type": "mcq",
    "question": "What is ...?",
    "correct_answer": "A",
    "explanation": "Because ...",
    "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},
    "concept_tags": ["concept1", "concept2"],
    "difficulty": 1
  }}
]
```

For non-MCQ types, omit the "options" field.
difficulty: 1 = easy, 2 = medium, 3 = hard.
concept_tags: 1-3 key concept keywords from the material.
explanation: 1-2 sentences explaining why the answer is correct.

Return ONLY the JSON array, no other text."""
