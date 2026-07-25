"""
Blinkit (grocery quick-commerce) scraper module.

Blinkit's own JSON search API (`/v1/layout/search`) returns clean structured
product data, but the API is behind bot-detection: calling it directly via
`context.request` (no real page JS) is answered with a 403 challenge page
regardless of headers spoofed (Referer, X-Requested-With, app_client all
tried). The only reliable path found is triggering the request from real
in-page JS, i.e. actually clicking the search bar and typing like a user,
then reading the response Blinkit's own frontend receives. This mirrors the
Zomato module's DOM-driven approach rather than Swiggy's direct-dapi-call
approach.

Verified live during development: location resolves correctly from
injected geolocation coordinates (e.g. "Royal Arcade, KHB Colony" for
12.9352,77.6146), and real product results were returned for "milk" (12
items, e.g. "Nandini Toned Milk 500 ml - ₹24") and "rice".
"""

import re

from playwright.async_api import Browser
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.schemas.models import MenuItem, PlatformSearchResult, SuggestedFoodItem, SuggestedResult
from app.scrapers.errors import ScraperError
from app.scrapers.resilience import jitter, random_user_agent, random_viewport, retry_with_backoff, session_cache

BASE = "https://blinkit.com"
PRICE_RE = re.compile(r"[\d,.]+")
SUGGESTED_QUERIES = ["milk", "bread", "eggs", "fruits", "vegetables"]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "item"


def _cache_key(lat: float, lng: float) -> str:
    # Rounded to ~1km so repeat requests from the same user/location reuse
    # the already-located session instead of re-running location detection.
    return f"blinkit:{round(lat, 2)}:{round(lng, 2)}"


async def _set_location(page) -> bool:
    """Loads the homepage and resolves delivery location from geolocation.
    Returns True if a servicable location was detected."""
    await retry_with_backoff(
        lambda: page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="domcontentloaded"),
        attempts=2,
    )
    try:
        await page.click("button:has-text('Detect my location')", timeout=5000)
    except PlaywrightTimeoutError:
        # Location prompt may not appear if a location is already set for this context.
        pass
    try:
        await page.wait_for_selector("text=Delivery in", timeout=10000)
    except PlaywrightTimeoutError:
        return False
    try:
        await page.wait_for_selector("text=Preparing your experience", state="hidden", timeout=10000)
    except PlaywrightTimeoutError:
        pass
    return True


async def _prepare(browser: Browser, lat: float, lng: float):
    """Returns (context, page, serviceable, cache_key). When a cached,
    already-located session exists for this approximate location, its cookies
    are attached to the new context — Blinkit then recognizes the location
    server-side and `_set_location` resolves it immediately without needing
    to click "Detect my location" again (that step already no-ops gracefully
    when the prompt doesn't appear, which is exactly what happens here)."""
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
        raise ScraperError("TIMEOUT", "Blinkit took too long to respond") from e
    except Exception as e:
        await context.close()
        raise ScraperError("BLOCKED", f"Could not reach Blinkit: {e}") from e

    if serviceable:
        session_cache.set(cache_key, await context.storage_state())
    return context, page, serviceable, cache_key


def _parse_products(data: dict) -> list[MenuItem]:
    items: list[MenuItem] = []
    snippets = data.get("response", {}).get("snippets", [])
    for snippet in snippets:
        if snippet.get("widget_type") != "product_card_snippet_type_2":
            continue
        d = snippet.get("data", {})
        name = d.get("name", {}).get("text")
        price_text = d.get("normal_price", {}).get("text", "")
        price_match = PRICE_RE.search(price_text.replace(",", ""))
        if not name or not price_match:
            continue
        product_id = str(d.get("identity", {}).get("id", ""))
        variant = d.get("variant", {}).get("text", "")
        image_url = d.get("image", {}).get("url")

        mrp_text = d.get("mrp", {}).get("text", "")
        mrp_match = PRICE_RE.search(mrp_text.replace(",", ""))
        original_price = float(mrp_match.group()) if mrp_match else None
        offer_text = d.get("offer_tag", {}).get("title", {}).get("text", "").replace("\n", " ").strip() or None

        items.append(
            MenuItem(
                id=product_id,
                name=name,
                restaurant_name=variant or "Blinkit",
                restaurant_id="blinkit",
                price=float(price_match.group()),
                delivery_fee=None,
                original_price=original_price if original_price != float(price_match.group()) else None,
                offer_text=offer_text,
                image_url=image_url,
                item_url=f"{BASE}/prn/{_slugify(name)}/prid/{product_id}" if product_id else None,
            )
        )
    return items


async def _search_products(page, query: str, cache_key: str) -> list[MenuItem]:
    async with page.expect_response(
        lambda r: "/v1/layout/search" in r.url and "q=" in r.url, timeout=25000
    ) as resp_info:
        search_bar = page.locator('[class*="SearchBar"]').first
        await search_bar.click(timeout=10000)
        await page.keyboard.type(query, delay=60)
    response = await resp_info.value
    if response.status in (403, 429):
        session_cache.invalidate(cache_key)
        raise ScraperError("BLOCKED", f"Blinkit blocked the request (status {response.status})")
    if not response.ok:
        raise ScraperError("UPSTREAM_ERROR", f"Blinkit returned status {response.status}")
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
            return PlatformSearchResult(platform="blinkit", availability="not_serviceable")
        items = await _search_products(page, query, cache_key)
        if not items:
            return PlatformSearchResult(
                platform="blinkit",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Blinkit',
            )
        return PlatformSearchResult(platform="blinkit", availability="available", items=items)
    except ScraperError:
        raise
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Blinkit took too long to respond") from e
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Blinkit search response: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    context, page, serviceable, cache_key = await _prepare(browser, lat, lng)
    try:
        if not serviceable:
            return SuggestedResult(platform="blinkit", availability="not_serviceable")
        items: list[SuggestedFoodItem] = []
        seen: set[str] = set()
        for term in SUGGESTED_QUERIES:
            await jitter(100, 350)
            try:
                products = await _search_products(page, term, cache_key)
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
        return SuggestedResult(platform="blinkit", availability="available", items=items)
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to build Blinkit suggestions: {e}") from e
    finally:
        await context.close()
