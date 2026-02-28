from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.attempt import WrongAnswerNote
from app.models.user import User
from app.services.email_service import send_email
from app.services.email_templates import render_review_reminder_email

logger = logging.getLogger(__name__)


async def send_review_reminders(db: AsyncSession) -> int:
    """Find users with due reviews and send reminder emails. Returns count sent."""
    now = datetime.now(UTC)

    stmt = (
        select(WrongAnswerNote.user_id, func.count(WrongAnswerNote.id))
        .where(
            WrongAnswerNote.next_review_at <= now,
            WrongAnswerNote.is_mastered == False,  # noqa: E712
        )
        .group_by(WrongAnswerNote.user_id)
    )
    results = (await db.execute(stmt)).all()

    sent = 0
    for user_id, due_count in results:
        user_stmt = select(User).where(User.id == user_id)
        user = (await db.execute(user_stmt)).scalar_one_or_none()
        if not user:
            continue

        review_url = f"{settings.frontend_base_url}/review"
        message = render_review_reminder_email(
            to_email=user.email,
            display_name=user.display_name,
            due_count=int(due_count),
            review_url=review_url,
        )
        await send_email(message)
        sent += 1

    logger.info("Sent %d review reminder emails", sent)
    return sent
