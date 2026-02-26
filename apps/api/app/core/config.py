from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


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
    jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION-use-at-least-32-bytes"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

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

    # Quiz generation defaults
    default_chunk_size: int = 1500  # characters
    default_chunk_overlap: int = 200  # characters
    max_questions_per_chunk: int = 5


settings = Settings()
