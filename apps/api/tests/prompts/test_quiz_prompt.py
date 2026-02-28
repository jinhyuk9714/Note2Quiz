from __future__ import annotations

import pytest

from app.prompts.quiz_prompt import build_quiz_generation_prompt, validate_quiz_items

SAMPLE_TEXT = "머신러닝은 데이터를 기반으로 패턴을 학습하는 인공지능의 한 분야이다."


class TestBuildQuizGenerationPrompt:
    def test_basic_prompt_generation(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=4,
            quiz_types=["mcq", "true_false", "short_answer", "fill_blank"],
        )
        assert "exactly 4 quiz questions" in result
        assert "mcq" in result
        assert "true_false" in result
        assert SAMPLE_TEXT in result

    def test_empty_chunk_text_raises(self) -> None:
        with pytest.raises(ValueError, match="chunk_text must not be empty"):
            build_quiz_generation_prompt(
                chunk_text="   ",
                n_questions=2,
                quiz_types=["mcq", "true_false"],
            )

    def test_empty_quiz_types_raises(self) -> None:
        with pytest.raises(ValueError, match="quiz_types must not be empty"):
            build_quiz_generation_prompt(
                chunk_text=SAMPLE_TEXT,
                n_questions=2,
                quiz_types=[],
            )

    def test_n_questions_zero_raises(self) -> None:
        with pytest.raises(ValueError, match="n_questions must be > 0"):
            build_quiz_generation_prompt(
                chunk_text=SAMPLE_TEXT,
                n_questions=0,
                quiz_types=["mcq"],
            )

    def test_n_questions_less_than_types_raises(self) -> None:
        with pytest.raises(ValueError, match="n_questions must be >= len"):
            build_quiz_generation_prompt(
                chunk_text=SAMPLE_TEXT,
                n_questions=1,
                quiz_types=["mcq", "true_false", "short_answer"],
            )

    def test_focus_concepts_included(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=2,
            quiz_types=["mcq", "true_false"],
            focus_concepts=["지도학습", "비지도학습"],
        )
        assert "Focus concepts" in result
        assert "지도학습" in result
        assert "비지도학습" in result

    def test_document_title_included(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=2,
            quiz_types=["mcq", "true_false"],
            document_title="인공지능 개론",
        )
        assert "Global context" in result
        assert "인공지능 개론" in result

    def test_already_covered_concepts_included(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=2,
            quiz_types=["mcq", "true_false"],
            already_covered_concepts=["딥러닝", "CNN"],
        )
        assert "Already covered concepts" in result
        assert "딥러닝" in result
        assert "CNN" in result

    def test_no_context_block_when_none(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=2,
            quiz_types=["mcq", "true_false"],
        )
        assert "Global context" not in result

    def test_distribution_with_remainder(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=5,
            quiz_types=["mcq", "true_false"],
        )
        assert "extra 1 question(s)" in result

    def test_distribution_even(self) -> None:
        result = build_quiz_generation_prompt(
            chunk_text=SAMPLE_TEXT,
            n_questions=4,
            quiz_types=["mcq", "true_false"],
        )
        assert "extra" not in result


def _make_mcq(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "quiz_type": "mcq",
        "question": "다음 중 올바른 것은?",
        "correct_answer": "A",
        "explanation": "A가 정답이다.",
        "concept_tags": ["개념1"],
        "difficulty": 2,
        "options": {"A": "정답", "B": "오답1", "C": "오답2", "D": "오답3"},
    }
    base.update(overrides)
    return base


def _make_tf(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "quiz_type": "true_false",
        "question": "지구는 둥글다.",
        "correct_answer": "O",
        "explanation": "지구는 구형이다.",
        "concept_tags": ["지구"],
        "difficulty": 1,
    }
    base.update(overrides)
    return base


def _make_fill_blank(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "quiz_type": "fill_blank",
        "question": "대한민국의 수도는 ___이다.",
        "correct_answer": "서울",
        "explanation": "서울이 수도이다.",
        "concept_tags": ["수도"],
        "difficulty": 1,
    }
    base.update(overrides)
    return base


class TestValidateQuizItems:
    def test_valid_mcq_passes(self) -> None:
        items = [_make_mcq()]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 1

    def test_invalid_quiz_type_dropped(self) -> None:
        items = [_make_mcq(quiz_type="unknown")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_disallowed_quiz_type_dropped(self) -> None:
        items = [_make_mcq()]
        result = validate_quiz_items(items, ["true_false"])
        assert len(result) == 0

    def test_empty_question_dropped(self) -> None:
        items = [_make_mcq(question="")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_empty_answer_dropped(self) -> None:
        items = [_make_mcq(correct_answer="")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_empty_explanation_dropped(self) -> None:
        items = [_make_mcq(explanation="")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_invalid_difficulty_coerced(self) -> None:
        items = [_make_mcq(difficulty=5)]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 1
        assert result[0]["difficulty"] == 2

    def test_string_difficulty_coerced(self) -> None:
        items = [_make_mcq(difficulty="2")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 1
        assert result[0]["difficulty"] == 2

    def test_empty_concept_tags_dropped(self) -> None:
        items = [_make_mcq(concept_tags=[])]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_concept_tags_truncated_to_3(self) -> None:
        items = [_make_mcq(concept_tags=["a", "b", "c", "d"])]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 1
        assert len(result[0]["concept_tags"]) == 3  # type: ignore[arg-type]

    def test_mcq_missing_options_dropped(self) -> None:
        items = [_make_mcq(options=None)]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_mcq_wrong_option_keys_dropped(self) -> None:
        items = [_make_mcq(options={"A": "a", "B": "b", "C": "c"})]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_mcq_answer_not_in_options_dropped(self) -> None:
        items = [_make_mcq(correct_answer="E")]
        result = validate_quiz_items(items, ["mcq"])
        assert len(result) == 0

    def test_true_false_invalid_answer_dropped(self) -> None:
        items = [_make_tf(correct_answer="True")]
        result = validate_quiz_items(items, ["true_false"])
        assert len(result) == 0

    def test_true_false_valid(self) -> None:
        items = [_make_tf()]
        result = validate_quiz_items(items, ["true_false"])
        assert len(result) == 1

    def test_fill_blank_missing_blank_dropped(self) -> None:
        items = [_make_fill_blank(question="빈칸이 없는 질문")]
        result = validate_quiz_items(items, ["fill_blank"])
        assert len(result) == 0

    def test_fill_blank_valid(self) -> None:
        items = [_make_fill_blank()]
        result = validate_quiz_items(items, ["fill_blank"])
        assert len(result) == 1

    def test_non_mcq_options_set_to_none(self) -> None:
        items = [_make_tf(options={"A": "a"})]
        result = validate_quiz_items(items, ["true_false"])
        assert len(result) == 1
        assert result[0]["options"] is None

    def test_mixed_items_filters_correctly(self) -> None:
        items = [
            _make_mcq(),
            _make_mcq(question=""),  # invalid
            _make_tf(),
            _make_tf(correct_answer="maybe"),  # invalid
        ]
        result = validate_quiz_items(items, ["mcq", "true_false"])
        assert len(result) == 2
