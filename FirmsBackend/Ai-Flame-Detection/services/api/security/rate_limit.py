"""Distributed & In-Memory Rate Limiting Engine (SEC-004).

Supports sliding-window rate limiting with distributed Redis backend if available,
gracefully falling back to thread-safe in-memory bucket counters.
"""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from collections.abc import Callable
import threading
from typing import Annotated

from fastapi import HTTPException, Request, Response, status

from packages.config.settings import Settings, get_settings
from packages.logging import get_logger

logger = get_logger("services.api.security.rate_limit")


class RateLimiter:
    """Sliding-window rate limiter with optional Redis backing."""

    _instance: RateLimiter | None = None
    _lock = threading.Lock()

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._local_buckets: dict[str, list[float]] = defaultdict(list)
        self._local_lock = threading.Lock()
        self._redis_client = None
        self._redis_available = False
        self._init_redis()

    def _init_redis(self) -> None:
        """Attempt to connect to Redis for distributed rate-limiting."""
        try:
            import redis
            redis_url = self.settings.get_redis_url()
            r = redis.Redis.from_url(redis_url, socket_timeout=1.0)
            r.ping()
            self._redis_client = r
            self._redis_available = True
            logger.info("Distributed Redis rate-limiter connected successfully")
        except Exception:
            self._redis_client = None
            self._redis_available = False

    @classmethod
    def get_instance(cls) -> RateLimiter:
        """Singleton instance provider."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = RateLimiter()
        return cls._instance

    def is_rate_limited(
        self,
        key: str,
        max_requests: int = 60,
        window_seconds: int = 60,
    ) -> tuple[bool, int]:
        """Check if key has exceeded max_requests within window_seconds.

        Returns:
            tuple[bool, int]: (is_limited, remaining_retry_seconds)
        """
        now = time.time()
        redis_key = f"ratelimit:{key}"

        # 1. Distributed Redis sliding window
        if self._redis_available and self._redis_client:
            try:
                pipe = self._redis_client.pipeline()
                clear_before = now - window_seconds
                pipe.zremrangebyscore(redis_key, 0, clear_before)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {str(now): now})
                pipe.expire(redis_key, window_seconds + 5)
                _, count, _, _ = pipe.execute()

                if count >= max_requests:
                    return True, max(1, int(window_seconds))
                return False, 0
            except Exception:
                # Fallback to local memory on Redis failure
                self._redis_available = False

        # 2. Local memory sliding window
        with self._local_lock:
            timestamps = self._local_buckets[key]
            cutoff = now - window_seconds
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._local_buckets[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                earliest = min(valid_timestamps) if valid_timestamps else now
                retry_after = max(1, int(window_seconds - (now - earliest)))
                return True, retry_after

            self._local_buckets[key].append(now)
            return False, 0


def rate_limit(
    max_requests: int = 60,
    window_seconds: int = 60,
    key_prefix: str = "api",
) -> Callable[[Request, Response], None]:
    """FastAPI dependency factory enforcing rate limits on endpoints."""

    def dependency(request: Request, response: Response) -> None:
        # Determine client identifier: Auth user ID if present, else client IP
        client_ip = request.client.host if request.client else "127.0.0.1"
        auth_header = request.headers.get("Authorization", "")
        identifier = f"{key_prefix}:{auth_header[:24] if auth_header else client_ip}"

        limiter = RateLimiter.get_instance()
        is_limited, retry_after = limiter.is_rate_limited(
            key=identifier,
            max_requests=max_requests,
            window_seconds=window_seconds,
        )

        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Window"] = f"{window_seconds}s"

        if is_limited:
            response.headers["Retry-After"] = str(retry_after)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds}s. Retry after {retry_after}s.",
                headers={"Retry-After": str(retry_after)},
            )

    return dependency
