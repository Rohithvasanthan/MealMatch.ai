from fastapi import APIRouter, HTTPException, Request

from app.schemas.models import (
    AvailabilityResult,
    LocationQuery,
    Platform,
    PlatformSearchResult,
    SearchQuery,
    SuggestedResult,
)
from app.scrapers import bigbasket, blinkit, eatsure, instamart, swiggy, zepto, zomato
from app.scrapers.errors import ScraperError

router = APIRouter(prefix="/scrape")

MODULES = {
    "swiggy": swiggy,
    "zomato": zomato,
    "eatsure": eatsure,
    "blinkit": blinkit,
    "zepto": zepto,
    "instamart": instamart,
    "bigbasket": bigbasket,
}


def _module(platform: Platform):
    module = MODULES.get(platform)
    if module is None:
        raise HTTPException(status_code=404, detail=f"Unknown platform: {platform}")
    return module


@router.post("/{platform}/availability", response_model=AvailabilityResult)
async def availability(platform: Platform, body: LocationQuery, request: Request):
    module = _module(platform)
    browser = request.app.state.browser
    try:
        available = await module.check_availability(browser, body.lat, body.lng)
        return AvailabilityResult(platform=platform, available=available)
    except ScraperError as e:
        return AvailabilityResult(
            platform=platform, available=False, error_code=e.code, error_message=e.message
        )


@router.post("/{platform}/search", response_model=PlatformSearchResult)
async def search(platform: Platform, body: SearchQuery, request: Request):
    module = _module(platform)
    browser = request.app.state.browser
    try:
        return await module.search(browser, body.lat, body.lng, body.query)
    except ScraperError as e:
        return PlatformSearchResult(
            platform=platform, availability="error", error_code=e.code, error_message=e.message
        )


@router.post("/{platform}/suggested", response_model=SuggestedResult)
async def suggested(platform: Platform, body: LocationQuery, request: Request):
    module = _module(platform)
    browser = request.app.state.browser
    try:
        return await module.suggested(browser, body.lat, body.lng)
    except ScraperError as e:
        return SuggestedResult(
            platform=platform, availability="error", error_code=e.code, error_message=e.message
        )
