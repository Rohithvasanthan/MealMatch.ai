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
from app.scrapers.resilience import jitter, random_user_agent, random_viewport, retry_with_backoff, session_cache

BASE = "https://www.zeptonow.com"
CDN_BASE = "https://cdn.zeptonow.com/production"
SUGGESTED_QUERIES = ["milk", "bread", "eggs", "fruits", "vegetables"]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "item"


def _cache_key(lat: float, lng: float) -> str:
    return f"zepto:{round(lat, 2)}:{round(lng, 2)}"


async def _set_location(page) -> bool:
    """Loads the homepage and resolves delivery location from geolocation.
    Returns True if a serviceable location was detected. Zepto sometimes
    resolves location automatically from the geolocation permission alone
    (no modal), so a missing "Select Location" prompt is not itself a
    failure — only the absence of a resolved delivery-time badge is."""
    await retry_with_backoff(
        lambda: page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="load"),
        attempts=2,
    )
    try:
        await page.locator("text=Select Location").first.click(timeout=5000)
        await page.locator("text=Use My Current Location").first.click(timeout=5000)
    except PlaywrightTimeoutError:
        pass
    try:
        # The delivery-time badge renders the number and the word "minutes"
        # in separate DOM nodes, so match on the word alone rather than
        # requiring adjacency to a digit.
        await page.wait_for_selector("text=/minutes|mins\\b/i", timeout=15000)
    except PlaywrightTimeoutError:
        return False
    return True


async def _prepare(browser: Browser, lat: float, lng: float):
    """Returns (context, page, serviceable, cache_key). Mirrors Blinkit's
    session-reuse pattern: cookies/storage from a previously-located session
    for this approximate location are attached so repeat requests skip the
    location-detection flow."""
    cache_key = _cache_key(lat, lng)
    cached_state = session_cache.get(cache_key)
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
        serviceable = await _set_location(page)
    except PlaywrightTimeoutError as e:
        await context.close()
        raise ScraperError("TIMEOUT", "Zepto took too long to respond") from e
    except Exception as e:
        await context.close()
        raise ScraperError("BLOCKED", f"Could not reach Zepto: {e}") from e

    if serviceable:
        session_cache.set(cache_key, await context.storage_state())
    return context, page, serviceable, cache_key


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
    async with page.expect_response(
        lambda r: "bff-gateway.zepto.com/user-search-service" in r.url and r.request.method == "POST",
        timeout=30000,
    ) as resp_info:
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
    context, _page, serviceable, _cache_key_val = await _prepare(browser, lat, lng)
    await context.close()
    return serviceable


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context, page, serviceable, cache_key = await _prepare(browser, lat, lng)
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
            session_cache.invalidate(cache_key)
        raise
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Zepto took too long to respond") from e
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Zepto search response: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    context, page, serviceable, _cache_key_val = await _prepare(browser, lat, lng)
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
