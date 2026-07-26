"""
Fixture-based tests for the EatSure search-JSON parser.

`eatsure_search_response.json` is a trimmed real response captured live from
`/v1/api/search_product?keyword=biryani...` — verified during development
(see the module docstring in app/scrapers/eatsure.py). It has no
brand/restaurant name field, only a numeric `store_id`/`brand_id`, so
`_index_hrefs_by_product_id` recovers the brand slug (and therefore the
display name and deep link) from the real `<a href>` anchors rendered
alongside the results — these tests pin that matching logic down.
"""

import json
from pathlib import Path

import pytest

from app.scrapers.eatsure import (
    _brand_name_from_slug,
    _index_hrefs_by_product_id,
    _parse_products,
)

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def search_response() -> dict:
    return json.loads((FIXTURES / "eatsure_search_response.json").read_text())


@pytest.fixture
def hrefs() -> list:
    return [
        "/behrouz-biryani/200054605-lucknowi-lazeez-bhuna-murgh-biryani-dum-chicken-biryanimild-spicy",
        "/checkout",
        "/",
    ]


def test_parses_available_products(search_response, hrefs):
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    items = _parse_products(search_response, slug_by_id)

    assert len(items) == 1
    item = items[0]
    assert item.id == "200054605"
    assert item.name == "Lucknowi Lazeez Bhuna Murgh Biryani (Dum Chicken Biryani)(Mild Spicy)"
    assert item.price == 359.0
    assert item.rating == 4.2


def test_skips_unavailable_products(search_response, hrefs):
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    items = _parse_products(search_response, slug_by_id)
    assert all(item.id != "200099999" for item in items)


def test_recovers_brand_name_from_matching_href(search_response, hrefs):
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    items = _parse_products(search_response, slug_by_id)
    assert items[0].restaurant_name == "Behrouz Biryani"


def test_builds_item_url_from_matching_href(search_response, hrefs):
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    items = _parse_products(search_response, slug_by_id)
    assert items[0].item_url == (
        "https://www.eatsure.com/behrouz-biryani/200054605-lucknowi-lazeez-bhuna-murgh-biryani-dum-chicken-biryanimild-spicy"
    )


def test_falls_back_to_eatsure_when_no_matching_href(search_response):
    items = _parse_products(search_response, {})
    assert items[0].restaurant_name == "EatSure"
    assert items[0].item_url is None


def test_delivery_fee_is_always_none(search_response, hrefs):
    slug_by_id = _index_hrefs_by_product_id(hrefs)
    items = _parse_products(search_response, slug_by_id)
    assert items[0].delivery_fee is None


class TestIndexHrefsByProductId:
    def test_extracts_brand_slug_and_id(self):
        hrefs = ["/behrouz-biryani/200054605-some-dish-name"]
        index = _index_hrefs_by_product_id(hrefs)
        assert index[200054605] == ("behrouz-biryani", hrefs[0])

    def test_ignores_non_product_hrefs(self):
        index = _index_hrefs_by_product_id(["/checkout", "/", None, "/bengaluru/jakkasandra-fc"])
        assert index == {}


class TestBrandNameFromSlug:
    def test_title_cases_each_hyphenated_word(self):
        assert _brand_name_from_slug("behrouz-biryani") == "Behrouz Biryani"

    def test_handles_single_word_slug(self):
        assert _brand_name_from_slug("faasos") == "Faasos"
