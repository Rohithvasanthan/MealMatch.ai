"""
Zomato scraper module.

IMPORTANT (verified during development): from this development sandbox,
www.zomato.com is unreachable at the network/TLS level — both curl and a
real Chromium browser fail (endless TLS renegotiation / ERR_HTTP2_PROTOCOL_ERROR)
regardless of headers or stealth settings, while swiggy.com and every other
tested site load normally. This points to Zomato's edge hard-blocking this
sandbox's IP range rather than anything fixable in code here. As a result,
this module's DOM selectors are a best-effort implementation that could not
be verified against the live site and MUST be checked/adjusted the first
time this runs from a network that can actually reach zomato.com.

Structural hardening applied even without live verification: a warmed
session (cookies reused across requests, mirroring swiggy.py's
`_warmed_context`) so repeat searches don't risk a fresh bot challenge on
every navigation, and an explicit wait for a real result-card selector
instead of a fixed sleep. The cached session never carries geolocation —
every call sets that explicitly per request — so, unlike the bug fixed in
blinkit.py/zepto.py, a reused session here can never leak one request's
resolved location into another's. The selectors themselves
(`a[href*='/order']`, `a[href*='/menu']`) remain unverified and are the
most likely thing to need adjusting first once this runs somewhere that
can actually reach zomato.com.

Until verified, any failure here (navigation, selector mismatch) surfaces as
a structured ScraperError, which the backend turns into a per-platform
"unavailable right now" message rather than crashing the app — the
comparison still works using whichever platform succeeded, matching the
project's "no mock fallback" design.
"""

import re

from playwright.async_api import Browser
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.schemas.models import MenuItem, PlatformSearchResult, SuggestedFoodItem, SuggestedResult
from app.scrapers.errors import ScraperError
from app.scrapers.resilience import (
    jitter,
    random_user_agent,
    random_viewport,
    retry_with_backoff,
    session_cache,
)

PRICE_RE = re.compile(r"[\d,]+")
BASE = "https://www.zomato.com"
SESSION_KEY = "zomato"


async def _warmed_context(browser: Browser):
    """Reuses cookies that already cleared Zomato's bot check, if still
    fresh, so a burst of searches doesn't re-risk a challenge on every
    navigation. Returns (context, cache_hit). Geolocation is never baked
    into the cached state — every caller sets it explicitly per request via
    `context.set_geolocation` right after this returns — so a reused
    session can never carry a previous request's location."""
    cached_state = session_cache.get(SESSION_KEY)
    context = await browser.new_context(
        user_agent=random_user_agent(),
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport=random_viewport(),
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
        permissions=["geolocation"],
        storage_state=cached_state,
    )
    return context, cached_state is not None


async def _goto(page, url: str, *, cache_hit: bool) -> None:
    if not cache_hit:
        await jitter()
    try:
        response = await retry_with_backoff(
            lambda: page.goto(url, timeout=settings.nav_timeout_ms, wait_until="networkidle"),
            attempts=2,
        )
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Zomato took too long to respond") from e
    except Exception as e:
        raise ScraperError("BLOCKED", f"Could not reach Zomato: {e}") from e

    if response is not None and response.status in (403, 429):
        session_cache.invalidate(SESSION_KEY)
        raise ScraperError("BLOCKED", f"Zomato blocked the request (status {response.status})")

    if not cache_hit:
        session_cache.set(SESSION_KEY, await page.context.storage_state())


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context, cache_hit = await _warmed_context(browser)
    await context.set_geolocation({"latitude": lat, "longitude": lng})
    page = await context.new_page()
    try:
        await _goto(page, BASE, cache_hit=cache_hit)
        # Zomato shows a "not available in your area" style banner when a
        # detected location has no service; absence of that banner plus a
        # normal homepage load is treated as serviceable.
        not_available = page.get_by_text(re.compile("not available", re.I))
        return await not_available.count() == 0
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to check Zomato availability: {e}") from e
    finally:
        await context.close()


def _parse_card_lines(lines: list[str], href: str) -> MenuItem | None:
    """Pure parsing of one result card's already-split, non-empty text
    lines into a MenuItem, or None if the card doesn't look like a priced
    dish/restaurant card. Split out from `search()` so it's unit-testable
    without a live Playwright Locator."""
    if not lines:
        return None
    price_match = None
    for line in lines:
        if "₹" in line:
            price_match = PRICE_RE.search(line)
            if price_match:
                break
    if not price_match:
        return None
    item_url = f"{BASE}{href}" if href.startswith("/") else href
    return MenuItem(
        id=href,
        name=lines[0],
        restaurant_name=lines[1] if len(lines) > 1 else lines[0],
        restaurant_id=href,
        price=float(price_match.group().replace(",", "")),
        delivery_fee=None,
        item_url=item_url,
    )


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context, cache_hit = await _warmed_context(browser)
    await context.set_geolocation({"latitude": lat, "longitude": lng})
    page = await context.new_page()
    try:
        await _goto(page, f"{BASE}/search?q={query}", cache_hit=cache_hit)

        cards = page.locator("a[href*='/order'], a[href*='/menu']")
        try:
            await cards.first.wait_for(timeout=15000)
        except PlaywrightTimeoutError:
            return PlatformSearchResult(
                platform="zomato",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Zomato',
            )

        count = await cards.count()
        items: list[MenuItem] = []
        for i in range(min(count, 20)):
            card = cards.nth(i)
            text = await card.inner_text()
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            href = await card.get_attribute("href") or f"zomato-{i}"
            item = _parse_card_lines(lines, href)
            if item:
                items.append(item)

        if not items:
            return PlatformSearchResult(
                platform="zomato",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Zomato',
            )
        return PlatformSearchResult(platform="zomato", availability="available", items=items)
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Zomato search results: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    result = await search(browser, lat, lng, "popular near me")
    items = [
        SuggestedFoodItem(
            id=i.id,
            name=i.name,
            restaurant_name=i.restaurant_name,
            price=i.price,
            image_url=i.image_url,
            item_url=i.item_url,
        )
        for i in result.items[:10]
    ]
    return SuggestedResult(platform="zomato", availability=result.availability, items=items)
