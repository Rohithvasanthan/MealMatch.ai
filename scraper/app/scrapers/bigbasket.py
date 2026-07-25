"""
BigBasket (grocery) scraper module.

IMPORTANT (verified during development): `www.bigbasket.com` is hard-blocked
at Akamai's edge for a headless Chromium request — an immediate "Access
Denied" (`errors.edgesuite.net`) on the very first navigation, before any
in-page interaction, and it does not clear on a second attempt either. `curl`
reaches the same URL fine outside a browser context, which points to an
Akamai Bot Manager fingerprint check (headless-browser detection) rather
than a simple IP or rate-limit block. This is a harder wall than the AWS WAF
JS-challenge style used by Swiggy/Blinkit/Zepto, which a plain warm-up
navigation clears.

Per this project's "legal and technically supported methods only" policy
(see `resilience.py`), no stealth/fingerprint-evasion patches (masking
`navigator.webdriver`, spoofing plugins/canvas, etc.) are attempted to force
this open. This module is still wired in with the standard scraper contract
(best effort, same precedent as `zomato.py`/`instamart.py`): any failure
surfaces as a structured `ScraperError`, which the backend turns into a
per-platform "unavailable right now" message rather than crashing. The DOM
selectors below are unverified against a live, unblocked response and MUST
be checked/adjusted the first time this runs from a network/environment
that actually clears BigBasket's bot check.
"""

import re

from playwright.async_api import Browser
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.schemas.models import MenuItem, PlatformSearchResult, SuggestedFoodItem, SuggestedResult
from app.scrapers.errors import ScraperError
from app.scrapers.resilience import jitter, random_user_agent, random_viewport, retry_with_backoff

PRICE_RE = re.compile(r"[\d,]+")
BASE = "https://www.bigbasket.com"


async def _new_context(browser: Browser, lat: float, lng: float):
    return await browser.new_context(
        user_agent=random_user_agent(),
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport=random_viewport(),
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
        geolocation={"latitude": lat, "longitude": lng},
        permissions=["geolocation"],
    )


async def _goto(page, url: str):
    """Returns the navigation response so callers can check its status
    directly — Akamai's "Access Denied" banner text isn't rendered with
    perfect consistency, but the 403 it returns is."""
    await jitter()
    try:
        return await retry_with_backoff(
            lambda: page.goto(url, timeout=settings.nav_timeout_ms, wait_until="domcontentloaded"),
            attempts=2,
        )
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "BigBasket took too long to respond") from e
    except Exception as e:
        raise ScraperError("BLOCKED", f"Could not reach BigBasket: {e}") from e


def _raise_if_blocked(response) -> None:
    if response is not None and response.status in (403, 429):
        raise ScraperError("BLOCKED", f"BigBasket blocked the request (status {response.status})")


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context = await _new_context(browser, lat, lng)
    page = await context.new_page()
    try:
        response = await _goto(page, BASE)
        _raise_if_blocked(response)
        denied = page.get_by_text(re.compile("access denied|not serviceable", re.I))
        return await denied.count() == 0
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to check BigBasket availability: {e}") from e
    finally:
        await context.close()


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context = await _new_context(browser, lat, lng)
    page = await context.new_page()
    try:
        response = await _goto(page, f"{BASE}/ps/?q={query}")
        _raise_if_blocked(response)
        await page.wait_for_timeout(2000)

        blocked = await page.get_by_text(re.compile("access denied", re.I)).count()
        if blocked > 0:
            raise ScraperError("BLOCKED", "BigBasket blocked the request (Akamai edge denial)")

        cards = page.locator("a[href*='/pd/']")
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
            href = await card.get_attribute("href") or f"bigbasket-{i}"
            item_url = f"{BASE}{href}" if href.startswith("/") else href
            items.append(
                MenuItem(
                    id=href,
                    name=lines[0],
                    restaurant_name="BigBasket",
                    restaurant_id="bigbasket",
                    price=float(price_match.group().replace(",", "")),
                    delivery_fee=None,
                    item_url=item_url,
                )
            )

        if not items:
            return PlatformSearchResult(
                platform="bigbasket",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on BigBasket',
            )
        return PlatformSearchResult(platform="bigbasket", availability="available", items=items)
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse BigBasket search results: {e}") from e
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
    return SuggestedResult(platform="bigbasket", availability=result.availability, items=items)
