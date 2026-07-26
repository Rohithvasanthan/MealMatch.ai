"""
Unit tests for the Zomato result-card parser.

Unlike Swiggy/Zepto/Blinkit, Zomato is scraped by reading a result card's
already-rendered DOM text rather than a JSON API response, so there's no
JSON fixture to pin against. These tests instead cover `_parse_card_lines`,
the pure function `search()` delegates to, using hand-built line lists that
mimic what `card.inner_text().split("\\n")` would produce.

NOT covered here, and NOT verifiable from this environment (see the module
docstring in app/scrapers/zomato.py): whether the CSS selectors
(`a[href*='/order']`, `a[href*='/menu']`) actually match zomato.com's live
markup. That requires running against a network that can reach zomato.com.
"""

from app.scrapers.zomato import _parse_card_lines


def test_parses_a_card_with_price_and_two_lines():
    item = _parse_card_lines(["Chicken Biryani", "Meghana Foods", "₹375"], "/meghana-foods/order")

    assert item is not None
    assert item.name == "Chicken Biryani"
    assert item.restaurant_name == "Meghana Foods"
    assert item.price == 375.0
    assert item.id == "/meghana-foods/order"


def test_falls_back_to_first_line_as_restaurant_name_when_only_one_line():
    item = _parse_card_lines(["Meghana Foods ₹375"], "/meghana-foods/order")

    assert item is not None
    assert item.restaurant_name == item.name


def test_returns_none_when_no_price_line_present():
    lines = ["Meghana Foods", "Biryani specialists"]
    assert _parse_card_lines(lines, "/meghana-foods/order") is None


def test_returns_none_for_empty_lines():
    assert _parse_card_lines([], "/meghana-foods/order") is None


def test_strips_commas_from_thousands_separated_price():
    lines = ["Family Feast", "Meghana Foods", "₹1,250 for 2"]
    item = _parse_card_lines(lines, "/meghana-foods/order")

    assert item is not None
    assert item.price == 1250.0


def test_builds_absolute_item_url_from_relative_href():
    item = _parse_card_lines(["Chicken Biryani", "Meghana Foods", "₹375"], "/meghana-foods/order")

    assert item is not None
    assert item.item_url == "https://www.zomato.com/meghana-foods/order"


def test_keeps_already_absolute_item_url_unchanged():
    absolute = "https://www.zomato.com/some/other/path"
    item = _parse_card_lines(["Chicken Biryani", "Meghana Foods", "₹375"], absolute)

    assert item is not None
    assert item.item_url == absolute


def test_delivery_fee_is_always_none():
    # Zomato's search page markup doesn't expose a per-item delivery fee.
    item = _parse_card_lines(["Chicken Biryani", "Meghana Foods", "₹375"], "/meghana-foods/order")

    assert item is not None
    assert item.delivery_fee is None
