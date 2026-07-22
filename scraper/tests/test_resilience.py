import pytest

from app.scrapers.resilience import SessionCache, retry_with_backoff


class TestRetryWithBackoff:
    async def test_returns_result_on_first_success(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            return "ok"

        result = await retry_with_backoff(fn, attempts=3, base_delay=0.001)
        assert result == "ok"
        assert calls == 1

    async def test_retries_a_transient_failure_then_succeeds(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            if calls < 2:
                raise TimeoutError("transient")
            return "recovered"

        result = await retry_with_backoff(fn, attempts=3, base_delay=0.001)
        assert result == "recovered"
        assert calls == 2

    async def test_raises_the_last_error_once_attempts_are_exhausted(self):
        calls = 0

        async def fn():
            nonlocal calls
            calls += 1
            raise ValueError(f"failure {calls}")

        with pytest.raises(ValueError, match="failure 3"):
            await retry_with_backoff(fn, attempts=3, base_delay=0.001)
        assert calls == 3


class TestSessionCache:
    def test_returns_none_for_a_missing_key(self):
        cache = SessionCache(ttl_seconds=60)
        assert cache.get("swiggy") is None

    def test_returns_a_stored_value_before_expiry(self):
        cache = SessionCache(ttl_seconds=60)
        cache.set("swiggy", {"cookies": []})
        assert cache.get("swiggy") == {"cookies": []}

    def test_expires_after_the_ttl(self):
        cache = SessionCache(ttl_seconds=-1)  # already expired the instant it's set
        cache.set("swiggy", {"cookies": []})
        assert cache.get("swiggy") is None

    def test_invalidate_clears_a_stored_value(self):
        cache = SessionCache(ttl_seconds=60)
        cache.set("blinkit:12.97:77.59", {"cookies": []})
        cache.invalidate("blinkit:12.97:77.59")
        assert cache.get("blinkit:12.97:77.59") is None

    def test_keys_are_independent(self):
        cache = SessionCache(ttl_seconds=60)
        cache.set("swiggy", {"a": 1})
        cache.set("blinkit:1:1", {"b": 2})
        assert cache.get("swiggy") == {"a": 1}
        assert cache.get("blinkit:1:1") == {"b": 2}
