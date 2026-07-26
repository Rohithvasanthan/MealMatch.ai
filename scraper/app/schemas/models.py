from typing import Literal, Optional

from pydantic import BaseModel

Platform = Literal["swiggy", "zomato", "eatsure", "blinkit", "zepto", "instamart", "bigbasket"]
Availability = Literal["available", "not_serviceable", "error"]
ErrorCode = Literal[
    "TIMEOUT", "BLOCKED", "NOT_SERVICEABLE", "ITEM_NOT_FOUND", "PARSE_ERROR", "UPSTREAM_ERROR"
]


class LocationQuery(BaseModel):
    lat: float
    lng: float


class SearchQuery(LocationQuery):
    query: str


class MenuItem(BaseModel):
    id: str
    name: str
    restaurant_name: str
    restaurant_id: str
    price: float
    rating: Optional[float] = None
    eta_minutes: Optional[int] = None
    delivery_fee: Optional[float] = None
    platform_fee: Optional[float] = None
    packing_fee: Optional[float] = None
    original_price: Optional[float] = None
    offer_text: Optional[str] = None
    distance_km: Optional[float] = None
    image_url: Optional[str] = None
    item_url: Optional[str] = None


class PlatformSearchResult(BaseModel):
    platform: Platform
    availability: Availability
    items: list[MenuItem] = []
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None


class SuggestedFoodItem(BaseModel):
    id: str
    name: str
    restaurant_name: str
    price: float
    image_url: Optional[str] = None
    item_url: Optional[str] = None


class SuggestedResult(BaseModel):
    platform: Platform
    availability: Availability
    items: list[SuggestedFoodItem] = []
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None


class AvailabilityResult(BaseModel):
    platform: Platform
    available: bool
    error_code: Optional[ErrorCode] = None
    error_message: Optional[str] = None
