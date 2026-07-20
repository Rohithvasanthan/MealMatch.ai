"""
Swiggy scraper module.

Approach: load swiggy.com with a real browser first (this clears the AWS WAF
JS challenge and sets session cookies), then call Swiggy's own internal
`dapi` JSON endpoints directly through the same browser context. This is far
more robust than DOM scraping the rendered React app, and was verified live
against swiggy.com during development:
  - GET /dapi/restaurants/list/v5?lat&lng            -> restaurant listing (availability)
  - GET /dapi/restaurants/search/v3?lat&lng&str=...  -> dish/restaurant search

Swiggy does not expose a per-item delivery fee in these endpoints (fee is
only computed at cart/checkout time), so `delivery_fee` is left as None.
"""

from playwright.async_api import Browser
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.schemas.models import MenuItem, PlatformSearchResult, SuggestedFoodItem, SuggestedResult
from app.scrapers.errors import ScraperError

BASE = "https://www.swiggy.com"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)
SUGGESTED_QUERIES = ["biryani", "pizza", "burger", "rolls", "noodles"]


async def _warmed_context(browser: Browser):
    context = await browser.new_context(
        user_agent=UA,
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        viewport={"width": 1366, "height": 768},
        extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
    )
    page = await context.new_page()
    try:
        await page.goto(BASE, timeout=settings.nav_timeout_ms, wait_until="networkidle")
    except PlaywrightTimeoutError as e:
        await context.close()
        raise ScraperError("TIMEOUT", "Swiggy took too long to respond") from e
    except Exception as e:
        await context.close()
        raise ScraperError("BLOCKED", f"Could not reach Swiggy: {e}") from e
    finally:
        if not page.is_closed():
            await page.close()
    return context


def _restaurant_cards(data: dict) -> list[dict]:
    try:
        return data["data"]["cards"]
    except (KeyError, TypeError):
        return []


def _parse_dish_search(data: dict) -> list[MenuItem]:
    items: list[MenuItem] = []
    for outer in _restaurant_cards(data):
        grouped = outer.get("groupedCard", {}).get("cardGroupMap", {})
        dish_group = grouped.get("DISH", {})
        for c in dish_group.get("cards", []):
            inner = c.get("card", {}).get("card", {})
            if inner.get("@type") != "type.googleapis.com/swiggy.presentation.food.v2.DishGroup":
                continue
            restaurant = inner.get("restaurant", {}).get("info", {})
            sla = restaurant.get("sla", {})
            for dish in inner.get("dishes", []):
                info = dish.get("info", {})
                if not info.get("inStock", 1):
                    continue
                image_id = info.get("imageId")
                items.append(
                    MenuItem(
                        id=str(info.get("id")),
                        name=info.get("name", ""),
                        restaurant_name=restaurant.get("name", ""),
                        restaurant_id=str(restaurant.get("id", "")),
                        price=round(info.get("price", 0) / 100, 2),
                        rating=restaurant.get("avgRating"),
                        eta_minutes=sla.get("deliveryTime") or sla.get("maxDeliveryTime"),
                        delivery_fee=None,
                        image_url=(
                            f"https://media-assets.swiggy.com/swiggy/image/upload/{image_id}"
                            if image_id
                            else None
                        ),
                    )
                )
    return items


async def check_availability(browser: Browser, lat: float, lng: float) -> bool:
    context = await _warmed_context(browser)
    try:
        url = f"{BASE}/dapi/restaurants/list/v5?lat={lat}&lng={lng}&is-seo-homepage-enabled=true"
        resp = await context.request.get(url, headers={"Referer": f"{BASE}/"})
        if not resp.ok:
            raise ScraperError("UPSTREAM_ERROR", f"Swiggy returned status {resp.status}")
        data = await resp.json()
        return len(_restaurant_cards(data)) > 0
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError(
            "PARSE_ERROR", f"Failed to parse Swiggy availability response: {e}"
        ) from e
    finally:
        await context.close()


async def search(browser: Browser, lat: float, lng: float, query: str) -> PlatformSearchResult:
    context = await _warmed_context(browser)
    try:
        url = (
            f"{BASE}/dapi/restaurants/search/v3?lat={lat}&lng={lng}"
            f"&str={query}&trackingId=null&submitAction=ENTER"
        )
        resp = await context.request.get(url, headers={"Referer": f"{BASE}/search?query={query}"})
        if resp.status in (403, 429):
            raise ScraperError("BLOCKED", f"Swiggy blocked the request (status {resp.status})")
        if not resp.ok:
            raise ScraperError("UPSTREAM_ERROR", f"Swiggy returned status {resp.status}")
        data = await resp.json()
        if data.get("statusCode") not in (0, None):
            return PlatformSearchResult(platform="swiggy", availability="not_serviceable")
        items = _parse_dish_search(data)
        if not items:
            return PlatformSearchResult(
                platform="swiggy",
                availability="available",
                error_code="ITEM_NOT_FOUND",
                error_message=f'No results for "{query}" near this location on Swiggy',
            )
        return PlatformSearchResult(platform="swiggy", availability="available", items=items)
    except ScraperError:
        raise
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to parse Swiggy search response: {e}") from e
    finally:
        await context.close()


async def suggested(browser: Browser, lat: float, lng: float) -> SuggestedResult:
    context = await _warmed_context(browser)
    try:
        items: list[SuggestedFoodItem] = []
        seen_restaurants: set[str] = set()
        for term in SUGGESTED_QUERIES:
            url = (
                f"{BASE}/dapi/restaurants/search/v3?lat={lat}&lng={lng}"
                f"&str={term}&trackingId=null&submitAction=ENTER"
            )
            resp = await context.request.get(
                url, headers={"Referer": f"{BASE}/search?query={term}"}
            )
            if not resp.ok:
                continue
            data = await resp.json()
            for dish in _parse_dish_search(data):
                if dish.restaurant_id in seen_restaurants:
                    continue
                seen_restaurants.add(dish.restaurant_id)
                items.append(
                    SuggestedFoodItem(
                        id=dish.id,
                        name=dish.name,
                        restaurant_name=dish.restaurant_name,
                        price=dish.price,
                        image_url=dish.image_url,
                    )
                )
                break
        return SuggestedResult(platform="swiggy", availability="available", items=items)
    except Exception as e:
        raise ScraperError("PARSE_ERROR", f"Failed to build Swiggy suggestions: {e}") from e
    finally:
        await context.close()
