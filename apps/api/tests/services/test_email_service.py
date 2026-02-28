from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services.email_service import (
    ConsoleEmailBackend,
    EmailMessage,
    ResendEmailBackend,
    SMTPEmailBackend,
    get_email_backend,
    send_email,
)


def _msg() -> EmailMessage:
    return EmailMessage(
        to_email="user@example.com",
        to_name="Test User",
        subject="Test Subject",
        html_body="<p>Hello</p>",
        text_body="Hello",
    )


class TestConsoleEmailBackend:
    async def test_logs_email(self, caplog: pytest.LogCaptureFixture) -> None:
        import logging

        with caplog.at_level(logging.INFO):
            backend = ConsoleEmailBackend()
            await backend.send(_msg())

        assert "user@example.com" in caplog.text
        assert "Test Subject" in caplog.text


class TestSMTPEmailBackend:
    async def test_calls_aiosmtplib(self) -> None:
        backend = SMTPEmailBackend()
        mock_send = AsyncMock()
        with patch.dict("sys.modules", {"aiosmtplib": type("M", (), {"send": mock_send})()}):
            with patch("aiosmtplib.send", mock_send):
                await backend.send(_msg())
                mock_send.assert_called_once()


class TestResendEmailBackend:
    async def test_calls_resend_api(self) -> None:
        backend = ResendEmailBackend()
        mock_response = AsyncMock()
        mock_response.raise_for_status = lambda: None  # pyright: ignore[reportUnknownLambdaType]

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=None)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await backend.send(_msg())
            mock_client.post.assert_called_once()
            call_kwargs = mock_client.post.call_args
            assert "resend.com" in str(call_kwargs)


class TestGetEmailBackend:
    def test_console_default(self) -> None:
        backend = get_email_backend()
        assert isinstance(backend, ConsoleEmailBackend)

    def test_unknown_raises(self) -> None:
        with patch("app.services.email_service.settings") as mock_settings:
            mock_settings.email_backend = "unknown"
            with pytest.raises(ValueError, match="Unknown email backend"):
                get_email_backend()


class TestSendEmail:
    async def test_swallows_exception(self, caplog: pytest.LogCaptureFixture) -> None:
        import logging

        with (
            caplog.at_level(logging.ERROR),
            patch(
                "app.services.email_service.get_email_backend",
                return_value=AsyncMock(send=AsyncMock(side_effect=RuntimeError("SMTP error"))),
            ),
        ):
            await send_email(_msg())  # should not raise

        assert "Failed to send email" in caplog.text

    async def test_sends_successfully(self) -> None:
        mock_backend = AsyncMock()
        mock_backend.send = AsyncMock()
        with patch("app.services.email_service.get_email_backend", return_value=mock_backend):
            await send_email(_msg())
            mock_backend.send.assert_called_once()
