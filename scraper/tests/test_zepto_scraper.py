"""
Fixture-based tests for the Zepto product-grid JSON parser.

Pins down the shape `_parse_products` expects from Zepto's
`bff-gateway.zepto.com/user-search-service/api/v3/search` response, captured
live during development (see the module docstring in app/scrapers/zepto.py).
"""

import json
from pathlib import Path

import pytest

from app.scrapers.zepto import _parse_products, _slugify

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def search_response() -> dict:
    return json.loads((FIXTURES / "zepto_search_response.json").read_text())


def test_parses_in_stock_items_across_multiple_grids(search_response):
    items = _parse_products(search_response)
    assert len(items) == 2


def test_skips_out_of_stock_items(search_response):
    items = _parse_products(search_response)
    assert all(item.id != "9d447ba5-1d35-46e1-bc64-e932135d026f" for item in items)


def test_converts_price_from_paise_style_units_to_rupees(search_response):
    items = _parse_products(search_response)
    assert items[0].price == 26.0


def test_sets_original_price_only_when_discounted(search_response):
    items = _parse_products(search_response)
    milk = next(i for i in items if i.id == "ba77f9b3-0525-4ce8-bc4b-a2480419b780")
    assert milk.original_price == 27.0
    nandini = next(i for i in items if i.id == "25eb526c-9c26-48cd-95a3-8e4058910f8a")
    assert nandini.original_price is None


def test_builds_image_url_from_first_variant_image(search_response):
    items = _parse_products(search_response)
    milk = next(i for i in items if i.id == "ba77f9b3-0525-4ce8-bc4b-a2480419b780")
    assert milk.image_url == "https://cdn.zeptonow.com/production/cms/product_variant/8fd1fa19-56f7-4f23-8a0d-625fc669cec2.jpeg"


def test_image_url_is_none_when_no_images(search_response):
    items = _parse_products(search_response)
    nandini = next(i for i in items if i.id == "25eb526c-9c26-48cd-95a3-8e4058910f8a")
    assert nandini.image_url is None


def test_builds_item_url_from_slug_and_variant_id(search_response):
    items = _parse_products(search_response)
    milk = next(i for i in items if i.id == "ba77f9b3-0525-4ce8-bc4b-a2480419b780")
    assert milk.item_url == "https://www.zeptonow.com/pn/godrej-jersey-toned-milk/pvid/ba77f9b3-0525-4ce8-bc4b-a2480419b780"


def test_ignores_non_product_grid_widgets(search_response):
    items = _parse_products(search_response)
    assert len(items) == 2


class TestSlugify:
    def test_lowercases_and_hyphenates(self):
        assert _slugify("Godrej Jersey Toned Milk") == "godrej-jersey-toned-milk"

    def test_strips_punctuation(self):
        assert _slugify("Amul Taaza (500 ml)") == "amul-taaza-500-ml"

    def test_falls_back_to_item_when_empty(self):
        assert _slugify("!!!") == "item"
