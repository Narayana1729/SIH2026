"""Tests for distributed & in-memory sliding-window rate limiting engine."""

import time
from fastapi.testclient import TestClient

from services.api.app import app
from services.api.security.rate_limit import RateLimiter

client = TestClient(app)


def test_in_memory_rate_limiter_allows_under_limit():
    limiter = RateLimiter()
    # Force local memory mode for deterministic unit test
    limiter._redis_available = False
    key = "test_user_ok"

    for _ in range(5):
        is_limited, retry_after = limiter.is_rate_limited(key=key, max_requests=10, window_seconds=60)
        assert is_limited is False
        assert retry_after == 0


def test_in_memory_rate_limiter_blocks_over_limit():
    limiter = RateLimiter()
    limiter._redis_available = False
    key = "test_user_exceed"

    for _ in range(3):
        is_limited, _ = limiter.is_rate_limited(key=key, max_requests=3, window_seconds=10)
        assert is_limited is False

    # 4th request exceeds limit of 3
    is_limited, retry_after = limiter.is_rate_limited(key=key, max_requests=3, window_seconds=10)
    assert is_limited is True
    assert retry_after > 0


def test_rate_limit_cleanup():
    limiter = RateLimiter()
    limiter._redis_available = False
    key = "test_user_cleanup"

    limiter.is_rate_limited(key=key, max_requests=5, window_seconds=1)
    time.sleep(1.1)

    # After expiration of 1-second window, limit resets
    is_limited, retry_after = limiter.is_rate_limited(key=key, max_requests=5, window_seconds=1)
    assert is_limited is False
    assert retry_after == 0
