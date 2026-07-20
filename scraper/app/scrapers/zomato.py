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

BASE = "https://www.zomato.com"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
PRICE_RE = re.compile(r"[\d,]+")


async def _new_context(browser: Browser):
    context = await browser.new_context(
        user_agent=UA,
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport={"width": 1366, "height": 768},
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
        geolocation={"latitude": 0, "longitude": 0},
        permissions=["geolocation"],
    )
    return context


async def _goto(page, url: str):
    try:
        await page.goto(url, timeout=settings.nav_timeout_ms, wait_until="networkidle")
    except PlaywrightTimeoutError as e:
        raise ScraperError("TIMEOUT", "Zomato took too long to respond") from e
    except Exception as e:
        raise ScraperError("BLOCKED", f"Could not reach Zomato: {e}") from e


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context = await _new_context(browser)
    await context.set_geolocation({"latitude": lat, "longitude": lng})
    page = await context.new_page()
    try:
        await _goto(page, BASE)
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


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context = await _new_context(browser)
    await context.set_geolocation({"latitude": lat, "longitude": lng})
    page = await context.new_page()
    try:
        await _goto(page, f"{BASE}/search?q={query}")
        await page.wait_for_timeout(2000)

        cards = page.locator("a[href*='/order'], a[href*='/menu']")
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
            href = await card.get_attribute("href") or f"zomato-{i}"
            items.append(
                MenuItem(
                    id=href,
                    name=lines[0],
                    restaurant_name=lines[1] if len(lines) > 1 else lines[0],
                    restaurant_id=href,
                    price=float(price_match.group().replace(",", "")),
                    delivery_fee=None,
                )
            )

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
        )
        for i in result.items[:10]
    ]
    return SuggestedResult(platform="zomato", availability=result.availability, items=items)
