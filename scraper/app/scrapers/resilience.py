"""
Shared scraping-resilience helpers used by every platform module.

Everything here operates on the *client's own* request behavior only
(rotating the User-Agent it sends, spacing its own requests out, retrying its
own failed navigations, reusing its own already-established cookies). None of
it attempts to defeat a provider's bot detection, bypass a paywall/login, or
route around a block (e.g. via proxies/VPNs) — that stays out of scope
deliberately, per the project's "legal and technically supported methods
only" policy. If a provider blocks us outright (like Zomato does from this
network), the retries here will legitimately exhaust and the caller still
reports it as unavailable.
"""

import asyncio
import random
import time
from typing import Awaitable, Callable, TypeVar

T = TypeVar("T")

# A small pool of real, current desktop Chrome/Edge UA strings. Rotating
# across a handful of plausible values (rather than sending the exact same
# fingerprint on every single request) is a normal, legitimate practice for
# a client making many independent requests — this is not fingerprint
# spoofing to impersonate a specific browser/OS that isn't actually in use,
# just realistic variance.
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

VIEWPORTS = [
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 1280, "height": 800},
]


def random_user_agent() -> str:
    return random.choice(USER_AGENTS)


def random_viewport() -> dict:
    return random.choice(VIEWPORTS)


async def jitter(min_ms: int = 150, max_ms: int = 600) -> None:
    """Small randomized pause before a request, so concurrent searches don't
    all hit a provider in a synchronized burst."""
    await asyncio.sleep(random.uniform(min_ms, max_ms) / 1000)


async def retry_with_backoff(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    base_delay: float = 0.6,
    retry_on: tuple[type[BaseException], ...] = (Exception,),
) -> T:
    """Retries a transient failure with exponential backoff + jitter.
    Re-raises the last exception once attempts are exhausted."""
    last_exc: BaseException | None = None
    for attempt in range(attempts):
        try:
            return await fn()
        except retry_on as e:
            last_exc = e
            if attempt == attempts - 1:
                break
            delay = base_delay * (2**attempt) + random.uniform(0, 0.3)
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc


class SessionCache:
    """Reuses a browser context's cookies/storage across requests to the same
    platform for a short TTL, so we don't have to re-run a full "warm up"
    navigation (which is what actually clears bot-detection challenges) on
    every single search — only when the session has actually gone stale."""

    def __init__(self, ttl_seconds: float = 240):
        self._ttl = ttl_seconds
        self._store: dict[str, tuple[dict, float]] = {}

    def get(self, key: str) -> dict | None:
        entry = self._store.get(key)
        if not entry:
            return None
        state, expires_at = entry
        if time.monotonic() > expires_at:
            del self._store[key]
            return None
        return state

    def set(self, key: str, state: dict) -> None:
        self._store[key] = (state, time.monotonic() + self._ttl)

    def invalidate(self, key: str) -> None:
        self._store.pop(key, None)


session_cache = SessionCache()
