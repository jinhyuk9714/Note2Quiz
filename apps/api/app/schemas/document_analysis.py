from __future__ import annotations

import enum
import uuid

from pydantic import BaseModel, Field


class DocumentType(enum.StrEnum):
    VOCABULARY_BOOK = "vocabulary_book"
    LECTURE_NOTE = "lecture_note"
    TEXTBOOK_CHAPTER = "textbook_chapter"
    SLIDE_DECK = "slide_deck"
    RESEARCH_PAPER = "research_paper"
    WORKBOOK = "workbook"
    ARTICLE = "article"
    MIXED = "mixed"


class BlockKind(enum.StrEnum):
    LEARNING_CONTENT = "learning_content"
    INSTRUCTION = "instruction"
    TABLE_OF_CONTENTS = "table_of_contents"
    COVER = "cover"
    REFERENCE = "reference"
    APPENDIX = "appendix"
    ANSWER_KEY = "answer_key"
    PROMO = "promo"
    LOW_VALUE = "low_value"
    UNKNOWN = "unknown"


class StudyUnitType(enum.StrEnum):
    VOCABULARY_ENTRY = "vocabulary_entry"
    DEFINITION = "definition"
    CONCEPT = "concept"
    COMPARISON = "comparison"
    PROCESS = "process"
    RULE = "rule"
    FORMULA = "formula"
    CLAIM = "claim"
    EXAMPLE = "example"


class SourceBlock(BaseModel):
    block_id: str
    chunk_id: uuid.UUID
    index: int
    origin: str
    text: str
    heuristic_kind: BlockKind


class DocumentProfile(BaseModel):
    document_type: DocumentType
    dominant_language: str
    quizability_score: int = Field(ge=1, le=5)
    quizable_block_ids: list[str]
    ignored_block_ids: list[str]
    rationale: str


class StudyUnit(BaseModel):
    unit_id: str
    block_id: str
    chunk_id: uuid.UUID
    unit_type: StudyUnitType
    title: str
    content: str
    quizworthiness: int = Field(ge=1, le=5)
    concept_tags: list[str]
    source_excerpt: str
