"""
Fixture-based tests for the Swiggy dish-search JSON parser.

These pin down the shape `_parse_dish_search` expects from Swiggy's `dapi`
endpoint. Swiggy changes this response shape periodically (see the module
docstring in app/scrapers/swiggy.py) — when that happens, these tests are
meant to fail loudly against a captured live response rather than silently
degrading to empty results in production.
"""

import json
from pathlib import Path

import pytest

from app.scrapers.swiggy import _parse_dish_search, _restaurant_cards

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def search_response() -> dict:
    return json.loads((FIXTURES / "swiggy_search_response.json").read_text())


def test_parses_in_stock_dishes(search_response):
    items = _parse_dish_search(search_response)

    assert len(items) == 1
    item = items[0]
    assert item.id == "d1"
    assert item.name == "Chicken Boneless Biryani"
    assert item.restaurant_name == "Meghana Foods"
    assert item.restaurant_id == "12345"


def test_skips_out_of_stock_dishes(search_response):
    items = _parse_dish_search(search_response)
    assert all(item.id != "d2" for item in items)


def test_converts_price_from_paise_to_rupees(search_response):
    items = _parse_dish_search(search_response)
    assert items[0].price == 375.0


def test_prefers_delivery_time_over_max_delivery_time(search_response):
    items = _parse_dish_search(search_response)
    assert items[0].eta_minutes == 35


def test_builds_image_url_from_image_id(search_response):
    items = _parse_dish_search(search_response)
    assert items[0].image_url == "https://media-assets.swiggy.com/swiggy/image/upload/abc123"


def test_delivery_fee_is_always_none(search_response):
    # Swiggy's dapi endpoints don't expose a per-item delivery fee — see the
    # module docstring. This documents that as intentional, not an oversight.
    items = _parse_dish_search(search_response)
    assert items[0].delivery_fee is None


def test_ignores_non_dish_group_card_groups(search_response):
    # The second top-level card is a RESTAURANT group with no DISH key at
    # all — it must not raise and must contribute zero items.
    items = _parse_dish_search(search_response)
    assert len(items) == 1


class TestRestaurantCards:
    def test_returns_cards_list(self, search_response):
        assert len(_restaurant_cards(search_response)) == 2

    def test_returns_empty_list_when_data_key_missing(self):
        assert _restaurant_cards({}) == []

    def test_returns_empty_list_when_data_is_not_a_dict(self):
        assert _restaurant_cards({"data": None}) == []
