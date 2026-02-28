from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic.types import TextBlock

from app.schemas.document_analysis import (
    BlockKind,
    DocumentProfile,
    DocumentType,
    SourceBlock,
    StudyUnitType,
)
from app.services.study_unit_extractor import (
    _call_study_unit_llm,  # pyright: ignore[reportPrivateUsage]
    _deduplicate_text,  # pyright: ignore[reportPrivateUsage]
    _parse_study_units,  # pyright: ignore[reportPrivateUsage]
    _try_repair_truncated_json,  # pyright: ignore[reportPrivateUsage]
)


def _make_blocks(n: int = 2) -> list[SourceBlock]:
    blocks: list[SourceBlock] = []
    for i in range(n):
        cid = uuid.uuid4()
        blocks.append(
            SourceBlock(
                block_id=f"blk-{str(cid)[:8]}-{i}",
                chunk_id=cid,
                index=i,
                origin=f"chunk-{i}",
                text=f"Content block {i}",
                heuristic_kind=BlockKind.LEARNING_CONTENT,
            )
        )
    return blocks


class TestParseStudyUnits:
    """Test LLM response parsing for study units."""

    def test_valid_units_parsed(self) -> None:
        blocks = _make_blocks(2)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "definition",
                    "title": "머신러닝 정의",
                    "content": "데이터에서 패턴을 학습하는 인공지능의 한 분야",
                    "quizworthiness": 4,
                    "concept_tags": ["머신러닝", "인공지능"],
                    "source_excerpt": "머신러닝은 데이터에서...",
                },
                {
                    "unit_id": "unit-2",
                    "block_id": blocks[1].block_id,
                    "unit_type": "comparison",
                    "title": "지도학습 vs 비지도학습",
                    "content": "지도학습은 레이블이 있고, 비지도학습은 없다",
                    "quizworthiness": 5,
                    "concept_tags": ["지도학습", "비지도학습"],
                    "source_excerpt": "지도학습은...",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 2
        assert units[0].unit_type == StudyUnitType.DEFINITION
        assert units[0].title == "머신러닝 정의"
        assert units[1].unit_type == StudyUnitType.COMPARISON

    def test_invalid_block_id_filtered(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": "nonexistent-block",
                    "unit_type": "definition",
                    "title": "Test",
                    "content": "Test content",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 0

    def test_invalid_unit_type_filtered(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "invalid_type",
                    "title": "Test",
                    "content": "Test content",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 0

    def test_empty_title_filtered(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "concept",
                    "title": "",
                    "content": "Some content",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 0

    def test_empty_content_filtered(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "concept",
                    "title": "Some title",
                    "content": "",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 0

    def test_quizworthiness_clamped(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "rule",
                    "title": "Test Rule",
                    "content": "Some rule content",
                    "quizworthiness": 10,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 1
        assert units[0].quizworthiness == 5

    def test_concept_tags_truncated(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "formula",
                    "title": "Test Formula",
                    "content": "E = mc²",
                    "quizworthiness": 4,
                    "concept_tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 1
        assert len(units[0].concept_tags) == 3

    def test_code_fenced_response(self) -> None:
        blocks = _make_blocks(1)
        inner = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "concept",
                    "title": "Test",
                    "content": "Content",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        raw = f"```json\n{inner}\n```"
        units = _parse_study_units(raw, blocks)
        assert len(units) == 1

    def test_completely_invalid_json(self) -> None:
        blocks = _make_blocks(1)
        units = _parse_study_units("This is not JSON at all", blocks)
        assert units == []

    def test_empty_list_response(self) -> None:
        blocks = _make_blocks(1)
        units = _parse_study_units("[]", blocks)
        assert units == []

    def test_chunk_id_from_block_mapping(self) -> None:
        """Verify chunk_id comes from the block mapping, not from LLM output."""
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "definition",
                    "title": "Test",
                    "content": "Content",
                    "quizworthiness": 3,
                    "concept_tags": ["test"],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 1
        assert units[0].chunk_id == blocks[0].chunk_id

    def test_empty_concept_tags_replaced(self) -> None:
        blocks = _make_blocks(1)
        raw = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "concept",
                    "title": "Test",
                    "content": "Content",
                    "quizworthiness": 3,
                    "concept_tags": [],
                    "source_excerpt": "test",
                },
            ]
        )
        units = _parse_study_units(raw, blocks)
        assert len(units) == 1
        assert units[0].concept_tags == ["untagged"]

    def test_all_valid_unit_types(self) -> None:
        """Ensure all StudyUnitType values are accepted."""
        blocks = _make_blocks(1)
        for ut in StudyUnitType:
            raw = json.dumps(
                [
                    {
                        "unit_id": f"unit-{ut.value}",
                        "block_id": blocks[0].block_id,
                        "unit_type": ut.value,
                        "title": f"Test {ut.value}",
                        "content": f"Content for {ut.value}",
                        "quizworthiness": 3,
                        "concept_tags": ["test"],
                        "source_excerpt": "test",
                    },
                ]
            )
            units = _parse_study_units(raw, blocks)
            assert len(units) == 1, f"Failed for unit_type={ut.value}"


class TestDeduplicateText:
    """Test OCR text deduplication."""

    def test_no_duplication(self) -> None:
        text = "これは普通の文章です。重複はありません。"
        result = _deduplicate_text(text)
        assert "普通の文章" in result
        assert "重複はありません" in result

    def test_consecutive_sentence_dedup(self) -> None:
        text = "機械学習とは。機械学習とは。データから学ぶ。"
        result = _deduplicate_text(text)
        assert result.count("機械学習とは") == 1
        assert "データから学ぶ" in result

    def test_ocr_japanese_with_delimiter(self) -> None:
        """OCR duplication with sentence delimiters — deduped by line comparison."""
        text = "かれはわたしのあにです。かれはわたしのあにです。別の文。"
        result = _deduplicate_text(text)
        assert result.count("かれはわたしのあにです") == 1
        assert "別の文" in result

    def test_repeated_substring_in_deduped_text(self) -> None:
        """Regex handles long repeated substrings (>=10 chars, 3+ repeats)."""
        phrase = "これは長いフレーズです。"  # sentence with delimiter
        # After sentence-level dedup, inner regex handles inline repeats
        text = "aaa" + phrase * 3 + "bbb。"
        result = _deduplicate_text(text)
        # The regex (.{10,}?)\1{2,} should collapse the 3x repeat
        assert result.count("これは長いフレーズです") < 3

    def test_repeated_phrase_regex(self) -> None:
        """Substring >=10 chars repeated 3+ times is collapsed."""
        phrase = "This is a long enough phrase. "
        text = phrase * 5
        result = _deduplicate_text(text)
        assert result.count(phrase.strip()) < 5

    def test_mixed_delimiters(self) -> None:
        """Japanese and English sentence boundaries both split correctly."""
        text = "First sentence. First sentence. 日本語の文。日本語の文。End!"
        result = _deduplicate_text(text)
        assert result.count("First sentence") == 1
        assert result.count("日本語の文") == 1

    def test_short_text_passthrough(self) -> None:
        """Text with no sentence boundaries returns unchanged."""
        text = "short text no delimiters"
        result = _deduplicate_text(text)
        assert result == text

    def test_empty_text(self) -> None:
        assert _deduplicate_text("") == ""


class TestTryRepairTruncatedJson:
    """Test truncated JSON array repair."""

    def test_truncated_after_two_complete_items(self) -> None:
        text = '[{"a":1},{"b":2},{"c":3'
        result = _try_repair_truncated_json(text)
        assert len(result) == 2
        assert result[0] == {"a": 1}
        assert result[1] == {"b": 2}

    def test_no_complete_items(self) -> None:
        text = '[{"a":'
        result = _try_repair_truncated_json(text)
        assert result == []

    def test_single_complete_item(self) -> None:
        text = '[{"a":1},{"b":'
        result = _try_repair_truncated_json(text)
        assert len(result) == 1
        assert result[0] == {"a": 1}

    def test_truncated_with_newline_separator(self) -> None:
        text = '[{"a":1}\n,{"b":2}\n,{"c":'
        result = _try_repair_truncated_json(text)
        assert len(result) >= 1

    def test_realistic_study_unit_truncation(self) -> None:
        """Simulate a realistic truncated study unit JSON response."""
        complete_item = {
            "unit_id": "unit-blk-1",
            "block_id": "blk-1",
            "unit_type": "definition",
            "title": "Test",
            "content": "Content",
            "quizworthiness": 3,
            "concept_tags": ["test"],
            "source_excerpt": "excerpt",
        }
        truncated = (
            json.dumps([complete_item])[:-1]
            + ',{"unit_id":"unit-blk-2","block_id":"blk-2","unit_ty'
        )
        result = _try_repair_truncated_json(truncated)
        assert len(result) == 1
        assert result[0]["unit_id"] == "unit-blk-1"


def _make_profile(**overrides: object) -> DocumentProfile:
    defaults: dict[str, object] = {
        "document_type": DocumentType.VOCABULARY_BOOK,
        "dominant_language": "ja",
        "quizability_score": 4,
        "quizable_block_ids": ["blk-0"],
        "ignored_block_ids": [],
        "rationale": "test",
    }
    defaults.update(overrides)
    return DocumentProfile(**defaults)  # type: ignore[arg-type]


class TestCallStudyUnitLlm:
    """Test LLM call integration with mocked Anthropic API."""

    @pytest.mark.asyncio
    async def test_normal_response(self) -> None:
        blocks = _make_blocks(1)
        profile = _make_profile(quizable_block_ids=[blocks[0].block_id])

        llm_response_data = json.dumps(
            [
                {
                    "unit_id": "unit-1",
                    "block_id": blocks[0].block_id,
                    "unit_type": "definition",
                    "title": "Test Title",
                    "content": "Test Content",
                    "quizworthiness": 4,
                    "concept_tags": ["test"],
                    "source_excerpt": "excerpt",
                }
            ]
        )

        mock_text_block = MagicMock(spec=TextBlock)
        mock_text_block.text = llm_response_data
        mock_response = MagicMock()
        mock_response.content = [mock_text_block]
        mock_response.stop_reason = "end_turn"

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        result = await _call_study_unit_llm(blocks, profile, mock_client)
        assert len(result) == 1
        assert result[0].title == "Test Title"
        assert result[0].unit_type == StudyUnitType.DEFINITION

    @pytest.mark.asyncio
    async def test_max_tokens_truncation_logs_warning(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        blocks = _make_blocks(1)
        profile = _make_profile(quizable_block_ids=[blocks[0].block_id])

        # Simulate truncated response
        mock_text_block = MagicMock(spec=TextBlock)
        mock_text_block.text = "[]"
        mock_response = MagicMock()
        mock_response.content = [mock_text_block]
        mock_response.stop_reason = "max_tokens"

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        import logging

        with caplog.at_level(logging.WARNING):
            await _call_study_unit_llm(blocks, profile, mock_client)

        assert any("max_tokens" in r.message for r in caplog.records)

    @pytest.mark.asyncio
    async def test_dedup_applied_to_block_text(self) -> None:
        """Verify duplicated text in blocks is cleaned before sending to LLM."""
        cid = uuid.uuid4()
        blocks = [
            SourceBlock(
                block_id="blk-dup",
                chunk_id=cid,
                index=0,
                origin="chunk-0",
                text="重複テスト。重複テスト。重複テスト。",
                heuristic_kind=BlockKind.LEARNING_CONTENT,
            )
        ]
        profile = _make_profile(quizable_block_ids=["blk-dup"])

        mock_text_block = MagicMock(spec=TextBlock)
        mock_text_block.text = "[]"
        mock_response = MagicMock()
        mock_response.content = [mock_text_block]
        mock_response.stop_reason = "end_turn"

        mock_client = AsyncMock()
        mock_client.messages.create = AsyncMock(return_value=mock_response)

        with patch(
            "app.services.study_unit_extractor.build_study_unit_prompt",
            return_value="mocked prompt",
        ) as mock_prompt:
            await _call_study_unit_llm(blocks, profile, mock_client)
            call_args = mock_prompt.call_args
            sent_blocks = call_args.kwargs.get("blocks") or call_args[0][0]
            # The duplicated text should have been deduped
            sent_text = sent_blocks[0]["text"]
            assert sent_text.count("重複テスト") < 3
