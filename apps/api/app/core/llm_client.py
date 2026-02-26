from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Final

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMProfile:
    """Timeout and retry configuration for a specific LLM use case."""

    timeout_seconds: float
    max_retries: int
    max_tokens: int


PROFILE_QUIZ_GENERATION: Final = LLMProfile(
    timeout_seconds=settings.llm_timeout_quiz,
    max_retries=settings.llm_max_retries,
    max_tokens=4096,
)

PROFILE_SEMANTIC_GRADING: Final = LLMProfile(
    timeout_seconds=settings.llm_timeout_grading,
    max_retries=settings.llm_max_retries,
    max_tokens=1024,
)

PROFILE_OCR: Final = LLMProfile(
    timeout_seconds=settings.llm_timeout_ocr,
    max_retries=settings.llm_max_retries,
    max_tokens=4096,
)


class CircuitBreakerOpenError(Exception):
    """Raised when the circuit breaker is open and rejecting requests."""


class CircuitBreaker:
    """Simple circuit breaker for LLM API calls.

    States:
    - CLOSED: normal operation, requests pass through
    - OPEN: too many failures, requests are rejected immediately
    - HALF_OPEN: after cooldown, allow a single probe request
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
    ) -> None:
        self._failure_threshold = failure_threshold
        self._cooldown_seconds = cooldown_seconds
        self._failure_count: int = 0
        self._last_failure_time: float = 0.0
        self._state: str = "closed"

    @property
    def failure_threshold(self) -> int:
        return self._failure_threshold

    @property
    def state(self) -> str:
        if self._state == "open":
            elapsed = time.monotonic() - self._last_failure_time
            if elapsed >= self._cooldown_seconds:
                self._state = "half_open"
        return self._state

    def record_success(self) -> None:
        self._failure_count = 0
        self._state = "closed"

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.monotonic()
        if self._failure_count >= self._failure_threshold:
            self._state = "open"
            logger.warning(
                "Circuit breaker OPEN after %d failures (cooldown: %.0fs)",
                self._failure_count,
                self._cooldown_seconds,
            )

    def allow_request(self) -> bool:
        current = self.state
        if current == "closed":
            return True
        if current == "half_open":
            return True
        return False

    def reset(self) -> None:
        """Reset to initial closed state (useful for testing)."""
        self._failure_count = 0
        self._state = "closed"
        self._last_failure_time = 0.0


_circuit_breaker = CircuitBreaker(
    failure_threshold=settings.llm_circuit_breaker_threshold,
    cooldown_seconds=settings.llm_circuit_breaker_cooldown,
)


def get_circuit_breaker() -> CircuitBreaker:
    """Return the module-level circuit breaker singleton."""
    return _circuit_breaker


def create_llm_client(profile: LLMProfile) -> anthropic.AsyncAnthropic:
    """Create an AsyncAnthropic client with the given profile's settings.

    Raises:
        CircuitBreakerOpenError: If the circuit breaker is open.
    """
    if not _circuit_breaker.allow_request():
        raise CircuitBreakerOpenError(
            "LLM service is temporarily unavailable (circuit breaker open). Please try again later."
        )
    return anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=profile.timeout_seconds,
        max_retries=profile.max_retries,
    )
