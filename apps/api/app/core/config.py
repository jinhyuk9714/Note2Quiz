from __future__ import annotations

import logging
import warnings

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

_JWT_PLACEHOLDER = "CHANGE-ME-IN-PRODUCTION-use-at-least-32-bytes"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    app_name: str = "Note2Quiz API"
    debug: bool = False

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/quiznote"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Auth / JWT
    jwt_secret_key: str = _JWT_PLACEHOLDER
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30  # 30 minutes (access token)
    jwt_refresh_expire_days: int = 7  # 7 days (refresh token)
    password_reset_expire_minutes: int = 30

    # Frontend
    frontend_base_url: str = "http://localhost:3000"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Upload limits
    max_upload_size_mb: int = 20
    max_pdf_pages: int = 200

    # Rate limiting
    rate_limit_auth: str = "5/minute"
    rate_limit_quiz_gen: str = "10/minute"

    # Logging
    slow_query_threshold_ms: float = 500.0

    # LLM resilience
    llm_timeout_quiz: float = 120.0  # seconds
    llm_timeout_grading: float = 30.0  # seconds
    llm_timeout_ocr: float = 120.0  # seconds
    llm_max_retries: int = 2  # SDK-level retries (429/500/503)
    llm_circuit_breaker_threshold: int = 5  # failures before opening
    llm_circuit_breaker_cooldown: float = 60.0  # seconds before half-open
    llm_chunk_retry_attempts: int = 2  # app-level per-chunk retry

    # Email
    email_backend: str = "console"  # "console" | "smtp" | "resend"
    email_from_address: str = "noreply@note2quiz.com"
    email_from_name: str = "Note2Quiz"
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    resend_api_key: str = ""

    # Sentry
    sentry_dsn: str = ""
    sentry_environment: str = "development"
    sentry_traces_sample_rate: float = 0.1  # 10% of transactions

    # Quiz generation defaults
    default_chunk_size: int = 1500  # characters
    default_chunk_overlap: int = 200  # characters
    max_questions_per_chunk: int = 5

    @model_validator(mode="after")
    def _validate_production_settings(self) -> Settings:
        if not self.debug:
            if self.jwt_secret_key == _JWT_PLACEHOLDER:
                raise ValueError(
                    "JWT_SECRET_KEY must be set in production. "
                    'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"'
                )
        if not self.anthropic_api_key:
            warnings.warn(
                "ANTHROPIC_API_KEY is empty — quiz generation and grading will fail",
                stacklevel=1,
            )
        return self


settings = Settings()
