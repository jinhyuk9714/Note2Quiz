from __future__ import annotations

import csv
import io
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.document import Document
from app.models.quiz import Quiz, QuizItem
from app.models.user import User
from app.services.export_service import (
    _escape_html,  # pyright: ignore[reportPrivateUsage]
    _fetch_wrong_notes,  # pyright: ignore[reportPrivateUsage]
    _format_dt,  # pyright: ignore[reportPrivateUsage]
    generate_quiz_results_csv,
    generate_wrong_notes_csv,
    generate_wrong_notes_pdf,
)

# ── helpers ──────────────────────────────────────────────────


async def _create_doc_quiz_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    quiz_type: str = "mcq",
    question: str = "Q?",
    correct_answer: str = "A",
) -> tuple[Document, Quiz, QuizItem]:
    doc = Document(
        owner_id=user_id,
        title="Test Doc",
        source_type="text",
        char_count=100,
    )
    db.add(doc)
    await db.flush()

    quiz = Quiz(document_id=doc.id, title="Test Quiz", item_count=1)
    db.add(quiz)
    await db.flush()

    item = QuizItem(
        quiz_id=quiz.id,
        quiz_type=quiz_type,
        question=question,
        correct_answer=correct_answer,
        explanation="설명입니다.",
        options={"A": "a", "B": "b"} if quiz_type == "mcq" else None,
        concept_tags=["physics", "newton"],
        difficulty=2,
    )
    db.add(item)
    await db.flush()
    return doc, quiz, item


async def _create_wrong_note(
    db: AsyncSession,
    user_id: uuid.UUID,
    attempt_id: uuid.UUID,
    quiz_item_id: uuid.UUID,
    *,
    is_mastered: bool = False,
    concept_tags: list[str] | None = None,
    user_answer: str = "wrong",
    correct_answer: str = "right",
    wrong_reason: str = "이유입니다.",
    consecutive_correct: int = 0,
    next_review_at: datetime | None = None,
) -> WrongAnswerNote:
    note = WrongAnswerNote(
        attempt_id=attempt_id,
        user_id=user_id,
        quiz_item_id=quiz_item_id,
        user_answer=user_answer,
        correct_answer=correct_answer,
        wrong_reason=wrong_reason,
        concept_tags=concept_tags or ["physics"],
        is_mastered=is_mastered,
        consecutive_correct=consecutive_correct,
        next_review_at=next_review_at or (datetime.now(UTC) + timedelta(days=1)),
    )
    db.add(note)
    await db.flush()
    return note


async def _create_attempt(
    db: AsyncSession,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    *,
    score: int = 0,
    total: int = 1,
    answers: list[dict[str, object]] | None = None,
) -> QuizAttempt:
    attempt = QuizAttempt(
        user_id=user_id,
        quiz_id=quiz_id,
        attempt_number=1,
        score=score,
        total=total,
        answers=answers or [],
    )
    db.add(attempt)
    await db.flush()
    return attempt


# ── _format_dt ───────────────────────────────────────────────


class TestFormatDt:
    def test_formats_valid_datetime(self) -> None:
        dt = datetime(2025, 3, 15, 14, 30, tzinfo=UTC)
        assert _format_dt(dt) == "2025-03-15 14:30"

    def test_returns_empty_string_for_none(self) -> None:
        assert _format_dt(None) == ""


# ── _escape_html ─────────────────────────────────────────────


class TestEscapeHtml:
    def test_escapes_special_characters(self) -> None:
        assert _escape_html("<b>A & B</b>") == "&lt;b&gt;A &amp; B&lt;/b&gt;"

    def test_passes_through_safe_string(self) -> None:
        assert _escape_html("hello world") == "hello world"


# ── _fetch_wrong_notes ───────────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestFetchWrongNotes:
    async def test_returns_non_mastered_by_default(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id, is_mastered=False)

        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=None, concept_tag=None, search=None
        )
        assert len(notes) == 1

    async def test_filters_by_is_mastered_true(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id, is_mastered=True)

        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=True, concept_tag=None, search=None
        )
        assert len(notes) == 1

    async def test_filters_by_concept_tag(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(
            db_session, seeded_user.id, attempt.id, item.id, concept_tags=["math", "algebra"]
        )

        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=None, concept_tag="algebra", search=None
        )
        assert len(notes) == 1

    async def test_filters_by_search_text(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(
            db_session, seeded_user.id, question="뉴턴의 제3법칙은?"
        )
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id)

        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=None, concept_tag=None, search="뉴턴"
        )
        assert len(notes) == 1

    async def test_returns_empty_for_no_notes(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=None, concept_tag=None, search=None
        )
        assert notes == []

    async def test_loads_quiz_item_relationship(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id, question="Loaded?")
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id)

        notes = await _fetch_wrong_notes(
            db_session, seeded_user.id, is_mastered=None, concept_tag=None, search=None
        )
        assert notes[0].quiz_item is not None
        assert notes[0].quiz_item.question == "Loaded?"


# ── generate_wrong_notes_csv ─────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestGenerateWrongNotesCsv:
    async def test_csv_starts_with_bom(self, db_session: AsyncSession, seeded_user: User) -> None:
        result = await generate_wrong_notes_csv(db_session, seeded_user.id)
        assert result.startswith("\ufeff")

    async def test_csv_contains_header_row(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        result = await generate_wrong_notes_csv(db_session, seeded_user.id)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        header = next(reader)
        assert header == [
            "문제",
            "내 답변",
            "정답",
            "오답 분석",
            "개념 태그",
            "숙달 여부",
            "연속 정답",
            "다음 복습일",
            "생성일",
        ]

    async def test_csv_populates_data_columns(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(
            db_session, seeded_user.id, question="What is F=ma?"
        )
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(
            db_session,
            seeded_user.id,
            attempt.id,
            item.id,
            user_answer="F=mc2",
            correct_answer="F=ma",
            wrong_reason="잘못된 공식",
            concept_tags=["physics", "newton"],
            consecutive_correct=3,
        )

        result = await generate_wrong_notes_csv(db_session, seeded_user.id)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        next(reader)  # skip header
        row = next(reader)
        assert row[0] == "What is F=ma?"  # 문제
        assert row[1] == "F=mc2"  # 내 답변
        assert row[2] == "F=ma"  # 정답
        assert row[3] == "잘못된 공식"  # 오답 분석
        assert "physics" in row[4]  # 개념 태그
        assert row[5] == "X"  # 숙달 여부
        assert row[6] == "3"  # 연속 정답

    async def test_csv_mastered_shows_O(self, db_session: AsyncSession, seeded_user: User) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id, is_mastered=True)

        result = await generate_wrong_notes_csv(db_session, seeded_user.id, is_mastered=True)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        next(reader)  # skip header
        row = next(reader)
        assert row[5] == "O"

    async def test_csv_joins_concept_tags(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(
            db_session, seeded_user.id, attempt.id, item.id, concept_tags=["math", "algebra"]
        )

        result = await generate_wrong_notes_csv(db_session, seeded_user.id)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        next(reader)
        row = next(reader)
        assert row[4] == "math, algebra"

    async def test_csv_returns_only_header_when_no_notes(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        result = await generate_wrong_notes_csv(db_session, seeded_user.id)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        rows = list(reader)
        assert len(rows) == 1  # header only


# ── generate_wrong_notes_pdf ─────────────────────────────────
# NOTE: fitz.Story.draw() has compatibility issues in some environments,
# so we mock the PDF rendering and verify the function orchestration.


@pytest.mark.usefixtures("setup_database")
class TestGenerateWrongNotesPdf:
    async def test_returns_bytes(self, db_session: AsyncSession, seeded_user: User) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id)

        from unittest.mock import MagicMock, patch

        mock_doc = MagicMock()
        mock_doc.tobytes.return_value = b"%PDF-mock"
        mock_story = MagicMock()
        mock_story.place.return_value = (False, None)

        with (
            patch("app.services.export_service.fitz") as mock_fitz,
        ):
            mock_fitz.open.return_value = mock_doc
            mock_fitz.Story.return_value = mock_story
            mock_fitz.Rect.return_value = MagicMock()

            pdf = await generate_wrong_notes_pdf(db_session, seeded_user.id)

        assert pdf == b"%PDF-mock"
        mock_doc.new_page.assert_called_once()
        mock_story.place.assert_called_once()
        mock_story.draw.assert_called_once()

    async def test_pdf_calls_story_with_html_containing_notes(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(
            db_session, seeded_user.id, question="HTML test question?"
        )
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id)

        from unittest.mock import MagicMock, patch

        mock_doc = MagicMock()
        mock_doc.tobytes.return_value = b"%PDF-"
        mock_story = MagicMock()
        mock_story.place.return_value = (False, None)
        captured_html: list[str] = []

        def capture_story(html: str = "") -> MagicMock:
            captured_html.append(html)
            return mock_story

        with (
            patch("app.services.export_service.fitz") as mock_fitz,
        ):
            mock_fitz.open.return_value = mock_doc
            mock_fitz.Story.side_effect = capture_story
            mock_fitz.Rect.return_value = MagicMock()

            await generate_wrong_notes_pdf(db_session, seeded_user.id)

        assert len(captured_html) == 1
        assert "HTML test question?" in captured_html[0]
        assert "전체" in captured_html[0]  # default filter description

    async def test_pdf_html_contains_mastered_filter_description(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(db_session, seeded_user.id, quiz.id)
        await _create_wrong_note(db_session, seeded_user.id, attempt.id, item.id, is_mastered=True)

        from unittest.mock import MagicMock, patch

        mock_doc = MagicMock()
        mock_doc.tobytes.return_value = b"%PDF-"
        mock_story = MagicMock()
        mock_story.place.return_value = (False, None)
        captured_html: list[str] = []

        def capture_story(html: str = "") -> MagicMock:
            captured_html.append(html)
            return mock_story

        with (
            patch("app.services.export_service.fitz") as mock_fitz,
        ):
            mock_fitz.open.return_value = mock_doc
            mock_fitz.Story.side_effect = capture_story
            mock_fitz.Rect.return_value = MagicMock()

            await generate_wrong_notes_pdf(db_session, seeded_user.id, is_mastered=True)

        assert "숙달 완료" in captured_html[0]


# ── generate_quiz_results_csv ─────────────────────────────────


@pytest.mark.usefixtures("setup_database")
class TestGenerateQuizResultsCsv:
    async def test_returns_empty_when_quiz_not_found(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        result = await generate_quiz_results_csv(
            db_session, seeded_user.id, uuid.uuid4(), uuid.uuid4()
        )
        assert result == ""

    async def test_returns_empty_when_not_owner(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        other_user_id = uuid.UUID("00000000-0000-0000-0000-000000000099")
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(
            db_session,
            seeded_user.id,
            quiz.id,
            score=1,
            total=1,
            answers=[{"quiz_item_id": str(item.id), "user_answer": "A", "is_correct": True}],
        )

        result = await generate_quiz_results_csv(db_session, other_user_id, quiz.id, attempt.id)
        assert result == ""

    async def test_returns_empty_when_attempt_not_found(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, _ = await _create_doc_quiz_item(db_session, seeded_user.id)

        result = await generate_quiz_results_csv(db_session, seeded_user.id, quiz.id, uuid.uuid4())
        assert result == ""

    async def test_csv_contains_quiz_title_meta_row(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(
            db_session,
            seeded_user.id,
            quiz.id,
            score=1,
            total=1,
            answers=[{"quiz_item_id": str(item.id), "user_answer": "A", "is_correct": True}],
        )

        result = await generate_quiz_results_csv(db_session, seeded_user.id, quiz.id, attempt.id)
        assert "퀴즈: Test Quiz" in result

    async def test_csv_contains_score_and_percentage(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(
            db_session,
            seeded_user.id,
            quiz.id,
            score=1,
            total=2,
            answers=[{"quiz_item_id": str(item.id), "user_answer": "A", "is_correct": True}],
        )

        result = await generate_quiz_results_csv(db_session, seeded_user.id, quiz.id, attempt.id)
        assert "점수: 1/2" in result
        assert "정답률: 50%" in result

    async def test_csv_maps_quiz_type_to_korean(
        self, db_session: AsyncSession, seeded_user: User
    ) -> None:
        _, quiz, item = await _create_doc_quiz_item(
            db_session, seeded_user.id, quiz_type="short_answer"
        )
        attempt = await _create_attempt(
            db_session,
            seeded_user.id,
            quiz.id,
            score=0,
            total=1,
            answers=[{"quiz_item_id": str(item.id), "user_answer": "wrong", "is_correct": False}],
        )

        result = await generate_quiz_results_csv(db_session, seeded_user.id, quiz.id, attempt.id)
        assert "단답형" in result

    async def test_csv_shows_correct_o_x(self, db_session: AsyncSession, seeded_user: User) -> None:
        _, quiz, item = await _create_doc_quiz_item(db_session, seeded_user.id)
        attempt = await _create_attempt(
            db_session,
            seeded_user.id,
            quiz.id,
            score=0,
            total=1,
            answers=[{"quiz_item_id": str(item.id), "user_answer": "B", "is_correct": False}],
        )

        result = await generate_quiz_results_csv(db_session, seeded_user.id, quiz.id, attempt.id)
        reader = csv.reader(io.StringIO(result.lstrip("\ufeff")))
        rows = list(reader)
        # Meta rows (4) + blank row + header + data row
        data_row = rows[-1]
        assert data_row[5] == "X"  # 정답 여부
