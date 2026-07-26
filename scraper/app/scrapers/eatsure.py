"""
EatSure (Rebel Foods cloud-kitchen aggregator — Behrouz Biryani, Faasos, Oven
Story Pizza, The Good Bowl, Thalaiva Biryani, and other in-house brands)
scraper module.

Verified live during development: a plain, unauthenticated fetch of
eatsure.com 403s at the edge, but a real headless browser navigation gets
through cleanly. The site resolves delivery location from a "Locate Me"
control that reads the browser's geolocation — confirmed against injected
coordinates for Bangalore (12.9352, 77.6146), landing on a real
locality-scoped URL (`/bengaluru/jakkasandra-fc`). Search is driven through
the page's own "Search" control, which calls a real JSON API
(`/v1/api/search_product?keyword=...`) rather than server-rendering
results — so, like swiggy.py, this module reads that JSON directly instead
of scraping rendered DOM text for prices/names.

The one piece still read from the DOM: EatSure's search JSON carries a
numeric `brand_id`/`store_id` per product but no brand/restaurant *name*
field, so each JSON product's `product_id` is matched against the real
`<a href>` anchors rendered alongside the results (e.g.
`/behrouz-biryani/200054605-...`) to recover a brand slug for both the
display name and a working deep link.
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

BASE = "https://www.eatsure.com"
SESSION_KEY = "eatsure"
SUGGESTED_QUERIES = ["biryani", "pizza", "wraps", "bowl", "pasta"]
PRODUCT_HREF_RE = re.compile(r"^/([a-z0-9-]+)/(\d+)-")


async def _resolve_location(page) -> bool:
    """Clicks "Locate Me", which resolves delivery location from this
    context's injected geolocation and navigates to a locality-specific URL
    (e.g. /bengaluru/jakkasandra-fc) when serviceable. Must run in full on
    every request, cache hit or miss, so the result always reflects the
    current request's exact coordinates rather than a previously cached
    address."""
    start_url = page.url
    try:
        await page.click("text=Locate Me", timeout=8000)
    except PlaywrightTimeoutError:
        return False
    try:
        await page.wait_for_function(
            "u => window.location.href !== u", arg=start_url, timeout=10000
        )
    except PlaywrightTimeoutError:
        return False
    return True


async def _prepare(browser: Browser, lat: float, lng: float):
    """Returns (context, page, serviceable). The session cache only ever
    stores cookies captured right after the homepage loads — before
    location is touched — so a cache hit can only ever skip re-clearing
    EatSure's edge check, never re-resolving the address."""
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
        await retry_with_backoff(
            lambda: page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="networkidle"),
            attempts=2,
        )
        session_cache.set(SESSION_KEY, await context.storage_state())
        serviceable = await _resolve_location(page)
    except PlaywrightTimeoutError as e:
        await context.close()
        raise ScraperError("TIMEOUT", "EatSure took too long to respond") from e
    except Exception as e:
        await context.close()
        raise ScraperError("BLOCKED", f"Could not reach EatSure: {e}") from e

    return context, page, serviceable


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context, _page, serviceable = await _prepare(browser, lat, lng)
    await context.close()
    return serviceable


def _index_hrefs_by_product_id(hrefs: list) -> dict:
    """Maps each product_id found in a rendered result-card href to
    (brand_slug, full_href), so a display name and working deep link can be
    attached to the matching JSON product. EatSure's search JSON only
    carries a numeric brand_id/store_id, never a brand name."""
    index: dict = {}
    for href in hrefs:
        if not href:
            continue
        match = PRODUCT_HREF_RE.match(href)
        if not match:
            continue
        brand_slug, product_id = match.group(1), int(match.group(2))
        index[product_id] = (brand_slug, href)
    return index


def _brand_name_from_slug(slug: str) -> str:
    return " ".join(word.capitalize() for word in slug.split("-"))


def _parse_products(data: dict, slug_by_id: dict) -> list[MenuItem]:
    items: list[MenuItem] = []
    for product in data.get("data", {}).get("products", []):
        if not product.get("is_available"):
            continue
        product_id = product.get("product_id")
        name = product.get("product_name")
        price = product.get("price")
        if not product_id or not name or price is None:
            continue
        brand_slug, href = slug_by_id.get(product_id, (None, None))
        restaurant_name = _brand_name_from_slug(brand_slug) if brand_slug else "EatSure"
        items.append(
            MenuItem(
                id=str(product_id),
                name=name,
                restaurant_name=restaurant_name,
                restaurant_id=str(product.get("store_id") or brand_slug or "eatsure"),
                price=float(price),
                rating=product.get("rating"),
                delivery_fee=None,
                image_url=product.get("image"),
                item_url=f"{BASE}{href}" if href else None,
            )
        )
    return items


async def _open_search(page) -> None:
    try:
        await page.click("text=Search", timeout=8000)
    except PlaywrightTimeoutError:
        # Search UI may already be open (e.g. a repeat call in `suggested`).
        pass


async def _search_products(page, query: str) -> list[MenuItem]:
    await _open_search(page)
    search_input = page.locator("input").first
    async with page.expect_response(
        lambda r: "search_product" in r.url and r.request.method == "GET", timeout=20000
    ) as resp_info:
        await search_input.click(timeout=8000)
        await page.keyboard.type(query, delay=60)
        await page.wait_for_timeout(600)
    response = await resp_info.value
    if response.status in (403, 429):
        session_cache.invalidate(SESSION_KEY)
        raise ScraperError("BLOCKED", f"EatSure blocked the request (status {response.status})")
    if not response.ok:
        raise ScraperError("UPSTREAM_ERROR", f"EatSure returned status {response.status}")
    data = await response.json()

    hrefs = await page.eval_on_selector_all(
        "a[href]", "els => els.map(e => e.getAttribute('href'))"
    )
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    return _parse_products(data, slug_by_id)


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context, page, serviceable = await _prepare(browser, lat, lng)
    try:
        if not serviceable:
            return PlatformSearchResult(platform="eatsure", availability="not_serviceable")
        items = await _search_products(page, query)
        if not items:
            return PlatformSearchResult(
                platform="eatsure",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on EatSure',
            )
        return PlatformSearchResult(platform="eatsure", availability="available", items=items)
    except ScraperError:
        raise
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "EatSure took too long to respond") from e
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse EatSure search response: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    context, page, serviceable = await _prepare(browser, lat, lng)
    try:
        if not serviceable:
            return SuggestedResult(platform="eatsure", availability="not_serviceable")
        items: list[SuggestedFoodItem] = []
        seen: set[str] = set()
        for term in SUGGESTED_QUERIES:
            await jitter(100, 350)
            try:
                products = await _search_products(page, term)
            except ScraperError:
                continue
            for p in products:
                if p.restaurant_id in seen:
                    continue
                seen.add(p.restaurant_id)
                items.append(
                    SuggestedFoodItem(
                        id=p.id, name=p.name, restaurant_name=p.restaurant_name,
                        price=p.price, image_url=p.image_url, item_url=p.item_url,
                    )
                )
                break
        return SuggestedResult(platform="eatsure", availability="available", items=items)
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to build EatSure suggestions: {e}") from e
    finally:
        await context.close()
