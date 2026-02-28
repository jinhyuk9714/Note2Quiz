from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import UTC, datetime

import fitz
from sqlalchemy import String, cast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attempt import QuizAttempt, WrongAnswerNote
from app.models.document import Document
from app.models.quiz import Quiz, QuizItem

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────
# Wrong Notes CSV
# ──────────────────────────────────────────────────────────

_WN_CSV_HEADER = [
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


async def _fetch_wrong_notes(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_mastered: bool | None,
    concept_tag: str | None,
    search: str | None,
) -> list[WrongAnswerNote]:
    """Fetch all wrong notes matching filters (no pagination)."""
    stmt = select(WrongAnswerNote).where(WrongAnswerNote.user_id == user_id)

    if is_mastered is not None:
        stmt = stmt.where(WrongAnswerNote.is_mastered == is_mastered)  # noqa: E712
    else:
        stmt = stmt.where(WrongAnswerNote.is_mastered == False)  # noqa: E712

    if concept_tag:
        dialect = db.bind.dialect.name if db.bind else "unknown"  # type: ignore[union-attr]
        if dialect == "postgresql":
            stmt = stmt.where(
                WrongAnswerNote.concept_tags.op("@>")(f'["{concept_tag}"]')  # type: ignore[union-attr]
            )
        else:
            stmt = stmt.where(
                cast(WrongAnswerNote.concept_tags, String).contains(f'"{concept_tag}"')
            )
    if search:
        stmt = stmt.join(WrongAnswerNote.quiz_item).where(QuizItem.question.ilike(f"%{search}%"))

    stmt = stmt.order_by(WrongAnswerNote.created_at.desc())
    stmt = stmt.options(selectinload(WrongAnswerNote.quiz_item))

    result = await db.execute(stmt)
    return list(result.scalars().all())


def _format_dt(dt: datetime | None) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M")


async def generate_wrong_notes_csv(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_mastered: bool | None = None,
    concept_tag: str | None = None,
    search: str | None = None,
) -> str:
    """Generate UTF-8 CSV string with BOM for wrong notes."""
    logger.info("Generating wrong notes CSV for user=%s", user_id)
    notes = await _fetch_wrong_notes(
        db, user_id, is_mastered=is_mastered, concept_tag=concept_tag, search=search
    )

    buf = io.StringIO()
    buf.write("\ufeff")  # UTF-8 BOM for Excel compatibility
    writer = csv.writer(buf)
    writer.writerow(_WN_CSV_HEADER)

    for n in notes:
        question = n.quiz_item.question if n.quiz_item else ""
        writer.writerow(
            [
                question,
                n.user_answer,
                n.correct_answer,
                n.wrong_reason,
                ", ".join(n.concept_tags),
                "O" if n.is_mastered else "X",
                n.consecutive_correct,
                _format_dt(n.next_review_at),
                _format_dt(n.created_at),
            ]
        )

    return buf.getvalue()


# ──────────────────────────────────────────────────────────
# Wrong Notes PDF
# ──────────────────────────────────────────────────────────

_PDF_CSS = """
body { font-family: sans-serif; font-size: 11px; color: #1e293b; }
h1 { font-size: 20px; margin-bottom: 4px; }
.meta { font-size: 10px; color: #64748b; margin-bottom: 16px; }
.card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.question { font-weight: bold; font-size: 12px; margin-bottom: 6px; }
.answers { display: flex; gap: 8px; margin-bottom: 6px; }
.answer-box { flex: 1; padding: 6px 8px; border-radius: 6px; font-size: 10px; }
.my-answer { background: #fef2f2; color: #dc2626; }
.correct-answer { background: #f0fdf4; color: #16a34a; }
.label { font-size: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
.analysis { background: #f8fafc; padding: 8px; border-radius: 6px; font-size: 10px; color: #475569; margin-bottom: 4px; }
.tags { font-size: 9px; color: #6366f1; }
.mastered { color: #16a34a; font-weight: bold; }
.not-mastered { color: #64748b; }
"""


def _escape_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def generate_wrong_notes_pdf(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_mastered: bool | None = None,
    concept_tag: str | None = None,
    search: str | None = None,
) -> bytes:
    """Generate a PDF byte string of wrong notes."""
    logger.info("Generating wrong notes PDF for user=%s", user_id)
    notes = await _fetch_wrong_notes(
        db, user_id, is_mastered=is_mastered, concept_tag=concept_tag, search=search
    )

    now_str = datetime.now(UTC).strftime("%Y-%m-%d %H:%M UTC")
    filter_desc = "전체"
    if is_mastered is True:
        filter_desc = "숙달 완료"
    elif concept_tag:
        filter_desc = f"태그: {_escape_html(concept_tag)}"

    cards_html = ""
    for i, n in enumerate(notes, 1):
        question = _escape_html(n.quiz_item.question if n.quiz_item else "")
        user_ans = _escape_html(n.user_answer)
        correct_ans = _escape_html(n.correct_answer)
        reason = _escape_html(n.wrong_reason) if n.wrong_reason else ""
        tags = ", ".join(n.concept_tags) if n.concept_tags else ""
        mastery_cls = "mastered" if n.is_mastered else "not-mastered"
        mastery_text = "숙달 완료" if n.is_mastered else f"연속 정답 {n.consecutive_correct}회"

        analysis_block = ""
        if reason:
            analysis_block = f'<div class="analysis"><b>분석:</b> {reason}</div>'

        tags_block = ""
        if tags:
            tags_block = f'<div class="tags">#{_escape_html(tags)}</div>'

        cards_html += f"""
        <div class="card">
            <div class="question">{i}. {question}</div>
            <table width="100%"><tr>
                <td width="50%"><div class="answer-box my-answer">
                    <div class="label">내 답변</div>{user_ans}
                </div></td>
                <td width="50%"><div class="answer-box correct-answer">
                    <div class="label">정답</div>{correct_ans}
                </div></td>
            </tr></table>
            {analysis_block}
            {tags_block}
            <div class="{mastery_cls}" style="font-size:9px;margin-top:4px;">{mastery_text}</div>
        </div>
        """

    html = f"""
    <html><head><style>{_PDF_CSS}</style></head><body>
    <h1>오답노트</h1>
    <div class="meta">{now_str} | {filter_desc} | {len(notes)}개 문항</div>
    {cards_html}
    </body></html>
    """

    # Render HTML to PDF using pymupdf Story
    doc = fitz.open()  # pyright: ignore[reportUnknownMemberType]
    story = fitz.Story(html=html)  # pyright: ignore[reportUnknownMemberType]

    # A4 page with margins
    page_width = 595.28
    page_height = 841.89
    margin = 50
    content_rect = fitz.Rect(margin, margin, page_width - margin, page_height - margin)  # pyright: ignore[reportUnknownMemberType]

    more: bool = True
    while more:
        page = doc.new_page(width=page_width, height=page_height)  # pyright: ignore[reportUnknownMemberType]
        more, _ = story.place(content_rect)  # pyright: ignore[reportUnknownMemberType,reportUnknownVariableType]
        story.draw(page, content_rect)  # pyright: ignore[reportUnknownMemberType]

    pdf_bytes: bytes = doc.tobytes()  # pyright: ignore[reportUnknownMemberType]
    doc.close()
    return pdf_bytes


# ──────────────────────────────────────────────────────────
# Quiz Results CSV
# ──────────────────────────────────────────────────────────

_QR_CSV_HEADER = [
    "#",
    "문제 유형",
    "문제",
    "내 답변",
    "정답",
    "정답 여부",
    "해설",
    "개념 태그",
]

_TYPE_LABELS = {
    "mcq": "객관식",
    "true_false": "O/X",
    "fill_blank": "빈칸 채우기",
    "short_answer": "단답형",
}


async def generate_quiz_results_csv(
    db: AsyncSession,
    user_id: uuid.UUID,
    quiz_id: uuid.UUID,
    attempt_id: uuid.UUID,
) -> str:
    """Generate CSV for a single quiz attempt's results."""
    # Verify ownership: Quiz → Document → owner_id
    quiz_stmt = (
        select(Quiz)
        .join(Quiz.document)
        .where(Quiz.id == quiz_id, Document.owner_id == user_id)
        .options(selectinload(Quiz.items))
    )
    quiz_result = await db.execute(quiz_stmt)
    quiz = quiz_result.scalar_one_or_none()
    if not quiz:
        return ""

    # Get attempt
    attempt_stmt = select(QuizAttempt).where(
        QuizAttempt.id == attempt_id,
        QuizAttempt.quiz_id == quiz_id,
        QuizAttempt.user_id == user_id,
    )
    attempt_result = await db.execute(attempt_stmt)
    attempt = attempt_result.scalar_one_or_none()
    if not attempt:
        return ""

    # Build item lookup
    items_map: dict[str, QuizItem] = {str(item.id): item for item in quiz.items}

    buf = io.StringIO()
    buf.write("\ufeff")  # BOM
    writer = csv.writer(buf)

    # Meta rows
    writer.writerow([f"퀴즈: {quiz.title}"])
    writer.writerow([f"점수: {attempt.score}/{attempt.total}"])
    pct = round(attempt.score / attempt.total * 100) if attempt.total > 0 else 0
    writer.writerow([f"정답률: {pct}%"])
    writer.writerow([f"응시일: {_format_dt(attempt.created_at)}"])
    writer.writerow([])  # blank row

    writer.writerow(_QR_CSV_HEADER)

    for idx, answer in enumerate(attempt.answers, 1):
        qi_id = str(answer["quiz_item_id"])
        item = items_map.get(qi_id)
        question = item.question if item else ""
        qt = item.quiz_type if item else None
        raw_type = qt.value if qt is not None and hasattr(qt, "value") else (str(qt) if qt else "")
        quiz_type = _TYPE_LABELS.get(raw_type, "")
        correct_answer = item.correct_answer if item else ""
        explanation = item.explanation if item else ""
        tags = ", ".join(item.concept_tags) if item and item.concept_tags else ""
        is_correct = "O" if answer.get("is_correct") else "X"
        user_answer = str(answer.get("user_answer", ""))

        writer.writerow(
            [
                idx,
                quiz_type,
                question,
                user_answer,
                correct_answer,
                is_correct,
                explanation,
                tags,
            ]
        )

    return buf.getvalue()
