"""Standalone script to send review reminder emails. Run via cron or scheduler."""

from __future__ import annotations

import asyncio
import logging

from app.core.database import async_session_factory
from app.tasks.review_reminder import send_review_reminders

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def main() -> None:
    async with async_session_factory() as db:
        sent = await send_review_reminders(db)
        print(f"Sent {sent} reminder emails")


if __name__ == "__main__":
    asyncio.run(main())
