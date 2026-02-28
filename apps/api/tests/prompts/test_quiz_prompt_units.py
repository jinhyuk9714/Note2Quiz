from __future__ import annotations

import pytest

from app.prompts.quiz_prompt import (
    _normalize_question_for_dedup,  # pyright: ignore[reportPrivateUsage]
    build_quiz_generation_prompt_from_units,
    validate_quiz_items_from_units,
)


def _make_unit(unit_id: str = "unit-1", **overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "unit_id": unit_id,
        "unit_type": "definition",
        "title": "테스트 개념",
        "content": "테스트 내용입니다.",
        "concept_tags": ["테스트"],
    }
    base.update(overrides)
    return base


def _make_mcq_with_units(
    source_unit_ids: list[str] | None = None,
    **overrides: object,
) -> dict[str, object]:
    base: dict[str, object] = {
        "quiz_type": "mcq",
        "question": "다음 중 올바른 것은?",
        "correct_answer": "A",
        "explanation": "A가 정답이다.",
        "concept_tags": ["개념1"],
        "difficulty": 2,
        "options": {"A": "정답", "B": "오답1", "C": "오답2", "D": "오답3"},
        "source_unit_ids": ["unit-1"] if source_unit_ids is None else source_unit_ids,
    }
    base.update(overrides)
    return base


def _make_tf_with_units(
    source_unit_ids: list[str] | None = None,
    **overrides: object,
) -> dict[str, object]:
    base: dict[str, object] = {
        "quiz_type": "true_false",
        "question": "지구는 둥글다.",
        "correct_answer": "O",
        "explanation": "지구는 대략적으로 구형이다.",
        "concept_tags": ["지구"],
        "difficulty": 1,
        "source_unit_ids": source_unit_ids or ["unit-1"],
    }
    base.update(overrides)
    return base


VALID_UNIT_IDS = {"unit-1", "unit-2", "unit-3"}


class TestBuildQuizGenerationPromptFromUnits:
    def test_basic_prompt_generation(self) -> None:
        units = [_make_unit("unit-1"), _make_unit("unit-2")]
        result = build_quiz_generation_prompt_from_units(
            units=units,
            n_questions=4,
            quiz_types=["mcq", "true_false"],
            document_type="lecture_note",
            language="ko",
        )
        assert "exactly 4 quiz questions" in result
        assert "mcq" in result
        assert "source_unit_ids" in result
        assert "lecture_note" in result

    def test_empty_units_raises(self) -> None:
        with pytest.raises(ValueError, match="units must not be empty"):
            build_quiz_generation_prompt_from_units(
                units=[],
                n_questions=2,
                quiz_types=["mcq"],
                document_type="mixed",
                language="ko",
            )

    def test_empty_quiz_types_raises(self) -> None:
        with pytest.raises(ValueError, match="quiz_types must not be empty"):
            build_quiz_generation_prompt_from_units(
                units=[_make_unit()],
                n_questions=2,
                quiz_types=[],
                document_type="mixed",
                language="ko",
            )

    def test_n_questions_zero_raises(self) -> None:
        with pytest.raises(ValueError, match="n_questions must be > 0"):
            build_quiz_generation_prompt_from_units(
                units=[_make_unit()],
                n_questions=0,
                quiz_types=["mcq"],
                document_type="mixed",
                language="ko",
            )

    def test_focus_concepts_included(self) -> None:
        result = build_quiz_generation_prompt_from_units(
            units=[_make_unit()],
            n_questions=2,
            quiz_types=["mcq", "true_false"],
            document_type="lecture_note",
            language="ko",
            focus_concepts=["딥러닝", "CNN"],
        )
        assert "딥러닝" in result
        assert "CNN" in result

    def test_document_type_strategy_included(self) -> None:
        result = build_quiz_generation_prompt_from_units(
            units=[_make_unit()],
            n_questions=2,
            quiz_types=["mcq", "true_false"],
            document_type="vocabulary_book",
            language="ko",
        )
        assert "meaning recall" in result or "usage distinction" in result

    def test_distribution_with_remainder(self) -> None:
        result = build_quiz_generation_prompt_from_units(
            units=[_make_unit()],
            n_questions=5,
            quiz_types=["mcq", "true_false"],
            document_type="mixed",
            language="ko",
        )
        assert "extra 1 question(s)" in result


class TestValidateQuizItemsFromUnits:
    def test_valid_item_passes(self) -> None:
        items = [_make_mcq_with_units(["unit-1"])]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 1

    def test_missing_source_unit_ids_rejected(self) -> None:
        item = _make_mcq_with_units()
        del item["source_unit_ids"]
        result = validate_quiz_items_from_units([item], ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_empty_source_unit_ids_rejected(self) -> None:
        items = [_make_mcq_with_units([])]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_invalid_unit_id_rejected(self) -> None:
        items = [_make_mcq_with_units(["nonexistent-unit"])]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_meta_question_rejected(self) -> None:
        """Questions about document structure should be rejected."""
        items = [
            _make_mcq_with_units(
                ["unit-1"],
                question="이 문서의 목차는 몇 개의 장으로 구성되어 있는가?",
            ),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_meta_question_english_rejected(self) -> None:
        items = [
            _make_mcq_with_units(
                ["unit-1"],
                question="How many chapters does this table of contents have?",
            ),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_meta_explanation_rejected(self) -> None:
        """Questions with meta-content in explanation should be rejected."""
        items = [
            _make_mcq_with_units(
                ["unit-1"],
                explanation="이 정답은 참고문헌에서 확인할 수 있다.",
            ),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_url_in_question_rejected(self) -> None:
        items = [
            _make_mcq_with_units(
                ["unit-1"],
                question="https://example.com에서 어떤 정보를 얻을 수 있는가?",
            ),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 0

    def test_duplicate_questions_deduped(self) -> None:
        items = [
            _make_mcq_with_units(["unit-1"], question="머신러닝의 정의는 무엇인가?"),
            _make_mcq_with_units(["unit-2"], question="머신러닝의 정의는 무엇인가?"),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 1

    def test_similar_questions_deduped(self) -> None:
        """Normalized comparison should catch similar questions."""
        items = [
            _make_mcq_with_units(["unit-1"], question="머신러닝의 정의는 무엇인가?"),
            _make_mcq_with_units(["unit-2"], question="머신러닝의  정의는  무엇인가?"),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 1

    def test_generic_tags_filtered(self) -> None:
        items = [
            _make_mcq_with_units(["unit-1"], concept_tags=["introduction", "머신러닝"]),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 1
        tags = result[0]["concept_tags"]
        assert isinstance(tags, list)
        assert "introduction" not in tags
        assert "머신러닝" in tags

    def test_all_generic_tags_keeps_first(self) -> None:
        """If all tags are generic, keep the first one to not drop the item."""
        items = [
            _make_mcq_with_units(["unit-1"], concept_tags=["introduction", "overview"]),
        ]
        result = validate_quiz_items_from_units(items, ["mcq"], VALID_UNIT_IDS)
        assert len(result) == 1
        tags: list[object] = result[0]["concept_tags"]  # type: ignore[assignment]
        assert isinstance(tags, list)
        assert len(tags) == 1

    def test_true_false_with_units(self) -> None:
        items = [_make_tf_with_units(["unit-1"])]
        result = validate_quiz_items_from_units(items, ["true_false"], VALID_UNIT_IDS)
        assert len(result) == 1

    def test_mixed_valid_and_invalid(self) -> None:
        items = [
            _make_mcq_with_units(["unit-1"]),  # valid
            _make_mcq_with_units([]),  # invalid: empty source
            _make_mcq_with_units(["unit-2"], question="목차를 보면 몇 개의 장이 있는가?"),  # meta
            _make_tf_with_units(["unit-3"]),  # valid
        ]
        result = validate_quiz_items_from_units(items, ["mcq", "true_false"], VALID_UNIT_IDS)
        assert len(result) == 2


class TestNormalizeQuestionForDedup:
    def test_basic_normalization(self) -> None:
        assert _normalize_question_for_dedup("Hello World!") == "hello world"

    def test_whitespace_normalization(self) -> None:
        assert _normalize_question_for_dedup("hello   world") == "hello world"

    def test_punctuation_removed(self) -> None:
        result = _normalize_question_for_dedup("다음 중 올바른 것은?")
        assert "?" not in result

    def test_korean_normalization(self) -> None:
        a = _normalize_question_for_dedup("머신러닝의 정의는 무엇인가?")
        b = _normalize_question_for_dedup("머신러닝의  정의는  무엇인가?")
        assert a == b
