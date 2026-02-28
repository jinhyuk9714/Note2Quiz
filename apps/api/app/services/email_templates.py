from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.core.config import settings
from app.services.email_service import EmailMessage

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)), autoescape=True)


def render_password_reset_email(
    to_email: str,
    display_name: str,
    reset_url: str,
) -> EmailMessage:
    template = _env.get_template("password_reset.html")
    html = template.render(
        subject=f"[{settings.app_name}] 비밀번호 재설정",
        display_name=display_name,
        reset_url=reset_url,
        expire_minutes=settings.password_reset_expire_minutes,
        app_name=settings.app_name,
    )
    return EmailMessage(
        to_email=to_email,
        to_name=display_name,
        subject=f"[{settings.app_name}] 비밀번호 재설정",
        html_body=html,
        text_body=f"비밀번호 재설정 링크: {reset_url} ({settings.password_reset_expire_minutes}분 후 만료)",
    )


def render_review_reminder_email(
    to_email: str,
    display_name: str,
    due_count: int,
    review_url: str,
) -> EmailMessage:
    template = _env.get_template("review_reminder.html")
    html = template.render(
        subject=f"[{settings.app_name}] 복습할 문제 {due_count}개",
        display_name=display_name,
        due_count=due_count,
        review_url=review_url,
        app_name=settings.app_name,
    )
    return EmailMessage(
        to_email=to_email,
        to_name=display_name,
        subject=f"[{settings.app_name}] 복습할 문제 {due_count}개가 있습니다",
        html_body=html,
        text_body=f"{due_count}개의 문제가 복습 시점에 도달했습니다. {review_url}",
    )
