"""
Swiggy Instamart (grocery quick-commerce) scraper module.

IMPORTANT (verified during development): `swiggy.com/instamart` is hard-blocked
by AWS WAF with an explicit "Request Blocked — your request looks automated"
403 page, even immediately after the exact homepage warm-up navigation
(`page.goto("https://www.swiggy.com")` with `networkidle`) that reliably
clears the WAF challenge for `swiggy.com` itself in `swiggy.py`. This means
the block is specific to the `/instamart` path/rule, not the shared session —
a code change here cannot fix it, and per this project's "legal and
technically supported methods only" policy (see `resilience.py`), no
stealth/fingerprint-evasion patches are attempted to force it open.

This module is still wired in with the standard scraper contract (best
effort, same as `zomato.py`): any failure surfaces as a structured
`ScraperError`, which the backend turns into a per-platform "unavailable
right now" message rather than crashing — the comparison still works using
whichever platform succeeded. The DOM selectors below are unverified against
a live, unblocked response and MUST be checked/adjusted the first time this
runs from a network that can actually reach `swiggy.com/instamart`.
"""

import re

from playwright.async_api import Browser
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.schemas.models import MenuItem, PlatformSearchResult, SuggestedFoodItem, SuggestedResult
from app.scrapers.errors import ScraperError
from app.scrapers.resilience import jitter, random_user_agent, random_viewport, retry_with_backoff

PRICE_RE = re.compile(r"[\d,]+")
BASE = "https://www.swiggy.com"
INSTAMART_URL = f"{BASE}/instamart"


async def _new_context(browser: Browser):
    return await browser.new_context(
        user_agent=random_user_agent(),
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport=random_viewport(),
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
        geolocation={"latitude": 0, "longitude": 0},
        permissions=["geolocation"],
    )


async def _warm_then_goto(page, lat: float, lng: float, url: str):
    """Same warm-up pattern as swiggy.py: clear the WAF challenge on the
    root domain first, then navigate to the target path in that session.
    Returns the final navigation's response so callers can check its status
    directly — the WAF's "Request Blocked" banner text isn't rendered with
    perfect consistency, but the 403 it returns is."""
    await jitter()
    try:
        await retry_with_backoff(
            lambda: page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="networkidle"),
            attempts=2,
        )
        await page.context.set_geolocation({"latitude": lat, "longitude": lng})
        return await retry_with_backoff(
            lambda: page.goto(url, timeout=settings.nav_timeout_ms, wait_until="domcontentloaded"),
            attempts=2,
        )
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Instamart took too long to respond") from e
    except Exception as e:
        raise ScraperError("BLOCKED", f"Could not reach Instamart: {e}") from e


def _raise_if_blocked(response) -> None:
    if response is not None and response.status in (403, 429):
        raise ScraperError("BLOCKED", f"Instamart blocked the request (status {response.status})")


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context = await _new_context(browser)
    page = await context.new_page()
    try:
        response = await _warm_then_goto(page, lat, lng, INSTAMART_URL)
        _raise_if_blocked(response)
        not_available = page.get_by_text(re.compile("not available|request blocked", re.I))
        return await not_available.count() == 0
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to check Instamart availability: {e}") from e
    finally:
        await context.close()


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context = await _new_context(browser)
    page = await context.new_page()
    try:
        response = await _warm_then_goto(page, lat, lng, f"{INSTAMART_URL}/search?custom_back=true&query={query}")
        _raise_if_blocked(response)
        await page.wait_for_timeout(2000)

        blocked = await page.get_by_text(re.compile("request blocked|looks automated", re.I)).count()
        if blocked > 0:
            raise ScraperError("BLOCKED", "Instamart blocked the request (WAF challenge page returned)")

        cards = page.locator("a[href*='/instamart/item']")
        count = await cards.count()
        items: list[MenuItem] = []
        for i in range(min(count, 20)):
            card = cards.nth(i)
            text = await card.inner_text()
            lines = [line.strip() for line in text.split("\n") if line.strip()]
            if not lines:
                continue
            price_match = None
            for line in lines:
                if "₹" in line:
                    price_match = PRICE_RE.search(line)
                    if price_match:
                        break
            if not price_match:
                continue
            href = await card.get_attribute("href") or f"instamart-{i}"
            item_url = f"{BASE}{href}" if href.startswith("/") else href
            items.append(
                MenuItem(
                    id=href,
                    name=lines[0],
                    restaurant_name="Instamart",
                    restaurant_id="instamart",
                    price=float(price_match.group().replace(",", "")),
                    delivery_fee=None,
                    item_url=item_url,
                )
            )

        if not items:
            return PlatformSearchResult(
                platform="instamart",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Instamart',
            )
        return PlatformSearchResult(platform="instamart", availability="available", items=items)
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Instamart search results: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    result = await search(browser, lat, lng, "milk")
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
    return SuggestedResult(platform="instamart", availability=result.availability, items=items)
