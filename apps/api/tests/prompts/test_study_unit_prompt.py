from __future__ import annotations

import pytest

from app.prompts.study_unit_prompt import (
    _get_type_guidance,  # pyright: ignore[reportPrivateUsage]
    build_study_unit_prompt,
)
from app.schemas.document_analysis import DocumentType


def _make_block(block_id: str = "blk-1", text: str = "Sample text") -> dict[str, str]:
    return {"block_id": block_id, "chunk_id": "00000000-0000-0000-0000-000000000001", "text": text}


class TestBuildStudyUnitPrompt:
    def test_basic_prompt_contains_all_fields(self) -> None:
        result = build_study_unit_prompt(
            blocks=[_make_block()],
            document_type="vocabulary_book",
            language="ja",
        )
        assert "vocabulary_book" in result
        assert "ja" in result
        assert "blk-1" in result
        assert "Sample text" in result
        assert "unit_type" in result
        assert "JSON" in result

    def test_empty_blocks_raises(self) -> None:
        with pytest.raises(ValueError, match="blocks must not be empty"):
            build_study_unit_prompt(blocks=[], document_type="mixed", language="ko")

    def test_vocabulary_guidance_included(self) -> None:
        result = build_study_unit_prompt(
            blocks=[_make_block()],
            document_type="vocabulary_book",
            language="ja",
        )
        assert "Vocabulary-specific" in result

    def test_lecture_note_guidance(self) -> None:
        result = build_study_unit_prompt(
            blocks=[_make_block()],
            document_type="lecture_note",
            language="ko",
        )
        assert "Lecture note" in result

    def test_all_document_types_produce_prompt(self) -> None:
        """Every DocumentType enum value should produce a valid prompt."""
        for dt in DocumentType:
            result = build_study_unit_prompt(
                blocks=[_make_block()],
                document_type=dt.value,
                language="en",
            )
            assert len(result) > 100
            assert "unit_type" in result

    def test_blocks_json_serialized(self) -> None:
        blocks = [
            _make_block("blk-a", "First block content"),
            _make_block("blk-b", "Second block content"),
        ]
        result = build_study_unit_prompt(
            blocks=blocks,
            document_type="textbook_chapter",
            language="ko",
        )
        assert "blk-a" in result
        assert "blk-b" in result
        assert "First block content" in result
        assert "Second block content" in result

    def test_unknown_document_type_uses_mixed_guidance(self) -> None:
        result = build_study_unit_prompt(
            blocks=[_make_block()],
            document_type="unknown_type",
            language="en",
        )
        assert "Mixed document" in result


class TestGetTypeGuidance:
    def test_known_types_return_specific_guidance(self) -> None:
        assert "Vocabulary" in _get_type_guidance("vocabulary_book")
        assert "Lecture" in _get_type_guidance("lecture_note")
        assert "Textbook" in _get_type_guidance("textbook_chapter")
        assert "Slide" in _get_type_guidance("slide_deck")
        assert "Research" in _get_type_guidance("research_paper")
        assert "Workbook" in _get_type_guidance("workbook")
        assert "Article" in _get_type_guidance("article")
        assert "Mixed" in _get_type_guidance("mixed")

    def test_unknown_type_falls_back_to_mixed(self) -> None:
        result = _get_type_guidance("nonexistent_type")
        assert "Mixed" in result
