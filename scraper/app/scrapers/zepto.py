"""
Zepto (grocery quick-commerce) scraper module.

Zepto's own search backend (`bff-gateway.zepto.com/user-search-service/api/v3/search`)
returns clean structured product data, but — same as Blinkit — it's only
reachable from real in-page JS after a user has actually interacted with the
search bar; calling it directly via `context.request` without a live page
session is not attempted here. This module drives a real headless page
(type into the search bar, press Enter) and reads the JSON response the
page's own frontend receives, mirroring `blinkit.py`'s approach.

Verified live during development (from a network that can reach zeptonow.com):
location resolves from injected geolocation coordinates, and a "milk" search
returned 202 total matching products across several `PRODUCT_GRID` widgets,
e.g. "Godrej Jersey Toned Milk" at ₹26. Product deep links follow Zepto's own
`/pn/<slug>/pvid/<variantId>` route, confirmed against real anchors rendered
on the results page.
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

BASE = "https://www.zeptonow.com"
CDN_BASE = "https://cdn.zeptonow.com/production"
SUGGESTED_QUERIES = ["milk", "bread", "eggs", "fruits", "vegetables"]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "item"


SESSION_KEY = "zepto"


async def _load_homepage(page) -> None:
    """Just clears the WAF/bot challenge on the shared browser context — never
    touches location. Safe to skip on a cache hit since it carries no
    location state, unlike the old per-location cache key."""
    await retry_with_backoff(
        lambda: page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="load"),
        attempts=2,
    )


async def _resolve_location(page) -> bool:
    """Resolves delivery location from this context's injected geolocation.
    Must run in full on every request, cache hit or miss, so the result
    always reflects the current request's exact coordinates rather than a
    previously cached address. Returns True if a serviceable location was
    detected. Zepto sometimes resolves location automatically from the
    geolocation permission alone (no modal), so a missing "Select Location"
    prompt is not itself a failure.

    IMPORTANT (verified live against a real non-serviceable address,
    Pongalur/Tiruppur — 10.9711,77.3770): the delivery-time banner alone is
    not a valid serviceability signal — for this address it literally
    rendered as "Delivery in minutes*" (no digit, a generic placeholder),
    which still satisfies a bare "minutes" text match. (Requiring a digit
    immediately before "minutes" isn't reliable either — the number and
    the word render in separate DOM nodes.) The page also showed an
    explicit "Sit Tight! We're Coming Soon!" banner for that address, which
    a serviceable page does not show — that's the actual signal checked
    below."""
    try:
        await page.locator("text=Select Location").first.click(timeout=5000)
        await page.locator("text=Use My Current Location").first.click(timeout=5000)
    except PlaywrightTimeoutError:
        pass
    try:
        await page.wait_for_selector("text=/minutes|mins\\b/i", timeout=15000)
    except PlaywrightTimeoutError:
        return False

    # The "Coming Soon" banner (when present) renders a few seconds after
    # the minutes/mins banner above — an immediate count() check races it
    # and reads 0 even on a genuinely non-serviceable address (verified
    # live), so this must wait for it rather than checking synchronously.
    coming_soon = page.get_by_text(re.compile("coming soon", re.I))
    try:
        await coming_soon.first.wait_for(timeout=4000)
        return False
    except PlaywrightTimeoutError:
        return True


async def _prepare(browser: Browser, lat: float, lng: float):
    """Returns (context, page, serviceable). The session cache only ever
    stores cookies captured right after the homepage loads — before location
    is touched — so a cache hit can only ever skip re-clearing the WAF
    challenge, never re-resolving the address. Location is always resolved
    fresh, per request, from this call's exact lat/lng."""
    cached_state = session_cache.get(SESSION_KEY)
    context = await browser.new_context(
        user_agent=random_user_agent(),
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport=random_viewport(),
        geolocation={"latitude": lat, "longitude": lng},
        permissions=["geolocation"],
        storage_state=cached_state,
    )
    page = await context.new_page()

    try:
        if not cached_state:
            await jitter()
        await _load_homepage(page)
        session_cache.set(SESSION_KEY, await context.storage_state())
        serviceable = await _resolve_location(page)
    except PlaywrightTimeoutError as e:
        await context.close()
        raise ScraperError("TIMEOUT", "Zepto took too long to respond") from e
    except Exception as e:
        await context.close()
        raise ScraperError("BLOCKED", f"Could not reach Zepto: {e}") from e

    return context, page, serviceable


def _parse_products(data: dict) -> list[MenuItem]:
    items: list[MenuItem] = []
    for widget in data.get("layout", []):
        if widget.get("widgetId") != "PRODUCT_GRID":
            continue
        for entry in widget.get("data", {}).get("resolver", {}).get("data", {}).get("items", []):
            resp = entry.get("productResponse", {})
            if resp.get("outOfStock"):
                continue
            product = resp.get("product", {})
            variant = resp.get("productVariant", {})
            name = product.get("name")
            variant_id = variant.get("id")
            selling_price = resp.get("sellingPrice")
            if not name or not variant_id or selling_price is None:
                continue
            mrp = resp.get("mrp")
            images = variant.get("images") or []
            image_path = images[0].get("path") if images else None

            items.append(
                MenuItem(
                    id=variant_id,
                    name=name,
                    restaurant_name=product.get("brand") or "Zepto",
                    restaurant_id="zepto",
                    price=selling_price / 100,
                    delivery_fee=None,
                    original_price=(mrp / 100) if mrp and mrp != selling_price else None,
                    image_url=f"{CDN_BASE}/{image_path}" if image_path else None,
                    item_url=f"{BASE}/pn/{_slugify(name)}/pvid/{variant_id}",
                )
            )
    return items


async def _search_products(page, query: str) -> list[MenuItem]:
    try:
        await page.locator("text=Search for").first.click(timeout=12000)
    except PlaywrightTimeoutError:
        await page.locator("header input, [class*='Search'] input").first.click(timeout=12000)
    # Clicking "Search for" triggers a client-side route change to the search
    # page — give the new input time to mount before interacting with it.
    await page.wait_for_timeout(800)

    search_input = page.locator("input").first

    def _is_search_response(r):
        return "bff-gateway.zepto.com/user-search-service" in r.url and r.request.method == "POST"

    async with page.expect_response(_is_search_response, timeout=30000) as resp_info:
        await search_input.click(timeout=8000)
        await page.keyboard.type(query, delay=60)
        await page.wait_for_timeout(400)
        await page.keyboard.press("Enter")
    response = await resp_info.value
    if response.status in (403, 429):
        raise ScraperError("BLOCKED", f"Zepto blocked the request (status {response.status})")
    if not response.ok:
        raise ScraperError("UPSTREAM_ERROR", f"Zepto returned status {response.status}")
    data = await response.json()
    return _parse_products(data)


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context, _page, serviceable = await _prepare(browser, lat, lng)
    await context.close()
    return serviceable


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context, page, serviceable = await _prepare(browser, lat, lng)
    try:
        if not serviceable:
            return PlatformSearchResult(platform="zepto", availability="not_serviceable")
        items = await _search_products(page, query)
        if not items:
            return PlatformSearchResult(
                platform="zepto",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Zepto',
            )
        return PlatformSearchResult(platform="zepto", availability="available", items=items)
    except ScraperError as e:
        if e.code == "BLOCKED":
            session_cache.invalidate(SESSION_KEY)
        raise
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Zepto took too long to respond") from e
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Zepto search response: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    context, page, serviceable = await _prepare(browser, lat, lng)
    try:
        if not serviceable:
            return SuggestedResult(platform="zepto", availability="not_serviceable")
        items: list[SuggestedFoodItem] = []
        seen: set[str] = set()
        for term in SUGGESTED_QUERIES:
            await jitter(100, 350)
            try:
                products = await _search_products(page, term)
            except ScraperError:
                continue
            for p in products:
                if p.id in seen:
                    continue
                seen.add(p.id)
                items.append(
                    SuggestedFoodItem(
                        id=p.id, name=p.name, restaurant_name=p.restaurant_name,
                        price=p.price, image_url=p.image_url, item_url=p.item_url,
                    )
                )
                break
        return SuggestedResult(platform="zepto", availability="available", items=items)
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to build Zepto suggestions: {e}") from e
    finally:
        await context.close()
