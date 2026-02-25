from __future__ import annotations

from app.prompts.grading_prompt import build_semantic_grading_prompt
from app.services.semantic_grading import parse_grading_response


class TestParseGradingResponse:
    def test_valid_json_array(self) -> None:
        raw = '[{"id": "a1", "is_correct": true}, {"id": "a2", "is_correct": false}]'
        result = parse_grading_response(raw)
        assert result == {"a1": True, "a2": False}

    def test_json_in_code_fence(self) -> None:
        raw = '```json\n[{"id": "x", "is_correct": true}]\n```'
        result = parse_grading_response(raw)
        assert result == {"x": True}

    def test_invalid_json_returns_empty(self) -> None:
        result = parse_grading_response("not json at all")
        assert result == {}

    def test_empty_string_returns_empty(self) -> None:
        result = parse_grading_response("")
        assert result == {}

    def test_missing_fields_skipped(self) -> None:
        raw = '[{"id": "a"}, {"id": "b", "is_correct": true}]'
        result = parse_grading_response(raw)
        assert result == {"b": True}

    def test_non_list_returns_empty(self) -> None:
        raw = '{"id": "a", "is_correct": true}'
        result = parse_grading_response(raw)
        assert result == {}

    def test_json_with_surrounding_text(self) -> None:
        raw = 'Here is the result:\n[{"id": "q1", "is_correct": false}]\nDone.'
        result = parse_grading_response(raw)
        assert result == {"q1": False}


class TestBuildSemanticGradingPrompt:
    def test_single_item(self) -> None:
        items = [
            {"id": "abc", "question": "Q?", "correct_answer": "A", "user_answer": "a"},
        ]
        prompt = build_semantic_grading_prompt(items)
        assert "abc" in prompt
        assert "Q?" in prompt
        assert "JSON array" in prompt

    def test_multiple_items(self) -> None:
        items = [
            {"id": "1", "question": "Q1", "correct_answer": "A1", "user_answer": "a1"},
            {"id": "2", "question": "Q2", "correct_answer": "A2", "user_answer": "a2"},
        ]
        prompt = build_semantic_grading_prompt(items)
        assert '"1"' in prompt
        assert '"2"' in prompt

    def test_special_characters_escaped(self) -> None:
        items = [
            {
                "id": "1",
                "question": 'He said "hello"',
                "correct_answer": "line1\nline2",
                "user_answer": "test\\value",
            },
        ]
        prompt = build_semantic_grading_prompt(items)
        # Should produce valid-looking content without breaking
        assert "1" in prompt
        assert "hello" in prompt
