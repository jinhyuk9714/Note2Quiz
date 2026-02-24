from __future__ import annotations

import json

from app.services.quiz_generation import _parse_quiz_json  # pyright: ignore[reportPrivateUsage]


class TestParseQuizJson:
    def test_plain_json_array(self) -> None:
        data = [{"quiz_type": "mcq", "question": "Q?"}]
        result = _parse_quiz_json(json.dumps(data))
        assert len(result) == 1
        assert result[0]["quiz_type"] == "mcq"

    def test_json_wrapped_in_code_fence(self) -> None:
        raw = '```json\n[{"quiz_type": "mcq"}]\n```'
        result = _parse_quiz_json(raw)
        assert len(result) == 1

    def test_json_with_questions_key(self) -> None:
        raw = json.dumps({"questions": [{"quiz_type": "short_answer"}]})
        result = _parse_quiz_json(raw)
        assert len(result) == 1

    def test_array_embedded_in_text(self) -> None:
        raw = 'Here are your questions: [{"quiz_type": "mcq"}] Hope this helps!'
        result = _parse_quiz_json(raw)
        assert len(result) == 1

    def test_completely_invalid_returns_empty(self) -> None:
        result = _parse_quiz_json("This is not JSON at all")
        assert result == []

    def test_empty_string(self) -> None:
        result = _parse_quiz_json("")
        assert result == []
