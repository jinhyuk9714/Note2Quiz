from __future__ import annotations

import abc
import logging
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class EmailMessage:
    to_email: str
    to_name: str
    subject: str
    html_body: str
    text_body: str | None = None


class EmailBackend(abc.ABC):
    @abc.abstractmethod
    async def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailBackend(EmailBackend):
    """Log email content to stdout. For development."""

    async def send(self, message: EmailMessage) -> None:
        logger.info(
            "EMAIL [to=%s] subject=%s\n%s",
            message.to_email,
            message.subject,
            message.text_body or message.html_body,
        )


class SMTPEmailBackend(EmailBackend):
    """Send email via SMTP using aiosmtplib."""

    async def send(self, message: EmailMessage) -> None:
        import aiosmtplib

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{settings.email_from_name} <{settings.email_from_address}>"
        msg["To"] = message.to_email
        msg["Subject"] = message.subject

        if message.text_body:
            msg.attach(MIMEText(message.text_body, "plain", "utf-8"))
        msg.attach(MIMEText(message.html_body, "html", "utf-8"))

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_use_tls,
        )


class ResendEmailBackend(EmailBackend):
    """Send email via Resend HTTP API (100 free emails/day)."""

    async def send(self, message: EmailMessage) -> None:
        import httpx

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={
                    "from": f"{settings.email_from_name} <{settings.email_from_address}>",
                    "to": [message.to_email],
                    "subject": message.subject,
                    "html": message.html_body,
                    "text": message.text_body,
                },
            )
            resp.raise_for_status()


_BACKENDS: dict[str, type[EmailBackend]] = {
    "console": ConsoleEmailBackend,
    "smtp": SMTPEmailBackend,
    "resend": ResendEmailBackend,
}


def get_email_backend() -> EmailBackend:
    backend_cls = _BACKENDS.get(settings.email_backend)
    if backend_cls is None:
        raise ValueError(f"Unknown email backend: {settings.email_backend}")
    return backend_cls()


async def send_email(message: EmailMessage) -> None:
    """Send an email using the configured backend. Never raises."""
    backend = get_email_backend()
    try:
        await backend.send(message)
    except Exception:
        logger.exception("Failed to send email to %s", message.to_email)
