from __future__ import annotations

import json


def build_semantic_grading_prompt(
    items: list[dict[str, str]],
) -> str:
    """Build a prompt that asks Claude to judge multiple answers at once.

    Each item has keys: id, question, correct_answer, user_answer.
    """
    entries = "\n".join(f"  {json.dumps(item, ensure_ascii=False)}" for item in items)

    return f"""You are a strict but fair university quiz grader.

For each answer below, decide if the student's answer is semantically correct compared to the correct answer.

Consider these as CORRECT:
- Synonyms or equivalent expressions (e.g., "OS" = "Operating System")
- Minor typos that don't change meaning (e.g., "photosythesis" = "photosynthesis")
- Different word ordering with the same meaning
- Abbreviations that are commonly accepted
- Extra/missing spaces, articles, particles, or trivial words
- Trailing punctuation differences (e.g., "Don't let me down." = "Don't let me down")
- If the correct_answer is a long explanation, the student only needs to capture the core meaning or key phrase to be considered correct

Consider these as INCORRECT:
- Factually wrong or substantially different meaning
- Missing key parts of the answer
- Vague or overly general when a specific answer is required

**Answers to grade**:
[
{entries}
]

**Output**: Return ONLY a JSON array. Each element:
```json
[
  {{"id": "...", "is_correct": true}},
  {{"id": "...", "is_correct": false}}
]
```

Return ONLY the JSON array, no other text."""
