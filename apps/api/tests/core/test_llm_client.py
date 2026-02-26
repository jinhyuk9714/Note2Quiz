from __future__ import annotations

import time
from unittest.mock import patch

import pytest

from app.core.llm_client import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    LLMProfile,
    create_llm_client,
    get_circuit_breaker,
)


class TestCircuitBreaker:
    def test_starts_closed(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_stays_closed_under_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_opens_at_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
        cb.record_failure()
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"
        assert cb.allow_request() is False

    def test_half_open_after_cooldown(self) -> None:
        # Use very small cooldown so it expires immediately
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        time.sleep(0.02)
        assert cb.state == "half_open"
        assert cb.allow_request() is True

    def test_success_resets_to_closed(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        time.sleep(0.02)
        assert cb.state == "half_open"

        cb.record_success()
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_failure_in_half_open_reopens(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=0.01)
        cb.record_failure()
        cb.record_failure()

        time.sleep(0.02)
        assert cb.state == "half_open"

        # Another failure should reopen
        cb.record_failure()
        assert cb.state == "open"

    def test_reset(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, cooldown_seconds=10.0)
        cb.record_failure()
        cb.record_failure()
        assert cb.state == "open"

        cb.reset()
        assert cb.state == "closed"
        assert cb.allow_request() is True

    def test_success_resets_failure_count(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, cooldown_seconds=10.0)
        cb.record_failure()
        cb.record_failure()
        cb.record_success()
        # After success, failures reset — need 3 more to open
        cb.record_failure()
        assert cb.state == "closed"


class TestCreateLLMClient:
    def setup_method(self) -> None:
        get_circuit_breaker().reset()

    def test_creates_client_with_profile(self) -> None:
        profile = LLMProfile(timeout_seconds=30.0, max_retries=1, max_tokens=1024)
        with patch("app.core.llm_client.settings") as mock_settings:
            mock_settings.anthropic_api_key = "test-key"
            mock_settings.llm_circuit_breaker_threshold = 5
            mock_settings.llm_circuit_breaker_cooldown = 60.0
            client = create_llm_client(profile)
        assert client is not None

    def test_raises_when_circuit_open(self) -> None:
        cb = get_circuit_breaker()
        for _ in range(cb.failure_threshold):
            cb.record_failure()
        assert cb.state == "open"

        profile = LLMProfile(timeout_seconds=30.0, max_retries=1, max_tokens=1024)
        with pytest.raises(CircuitBreakerOpenError):
            create_llm_client(profile)


class TestGetCircuitBreaker:
    def test_returns_singleton(self) -> None:
        cb1 = get_circuit_breaker()
        cb2 = get_circuit_breaker()
        assert cb1 is cb2
