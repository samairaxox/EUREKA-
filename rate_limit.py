"""Sliding-window rate limiter keyed by client IP and scope.

This is per-process memory. For multiple API workers, put the limit at the reverse proxy
or move the counters to Redis. See README, "Deployment".
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_lock = threading.Lock()
_hits: dict[tuple[str, str], deque] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce(request: Request, scope: str, limit_per_minute: int) -> None:
    key = (scope, _client_ip(request))
    now = time.monotonic()
    window_start = now - 60.0
    with _lock:
        hits = _hits[key]
        while hits and hits[0] < window_start:
            hits.popleft()
        if len(hits) >= limit_per_minute:
            retry_after = max(1, int(60 - (now - hits[0])))
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


def reset() -> None:
    """Used by tests."""
    with _lock:
        _hits.clear()
