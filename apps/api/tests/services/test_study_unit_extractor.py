from __future__ import annotations

import json
import uuid

from app.schemas.document_analysis import BlockKind, SourceBlock, StudyUnitType
from app.services.study_unit_extractor import (
    _parse_study_units,  # pyright: ignore[reportPrivateUsage]
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
