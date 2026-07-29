#!/usr/bin/env python3
"""Self-check for the two bits of rental_calls.py that can silently be wrong: which OSM entry a
pin gets matched to, and what a hand-typed MAX GROUP answer turns into.

    python3 scripts/test_rental_calls.py
"""
import csv
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rental_calls as rc


def test_match_prefers_name_over_distance():
    pin = {"name": "Joe's Pizza", "lat": 40.7300, "lng": -73.9970}
    elements = [
        {"tags": {"name": "Some Other Place", "amenity": "cafe"}, "lat": 40.73001, "lon": -73.99701},
        {"tags": {"name": "Joe's Pizza", "amenity": "restaurant"}, "lat": 40.73040, "lon": -73.9970},
    ]
    assert rc.match_osm(pin, elements)["tags"]["name"] == "Joe's Pizza"


def test_match_rejects_same_name_far_away():
    """A chain has the same name in twenty places — the branch across town is not this pin."""
    pin = {"name": "Starbucks", "lat": 40.7300, "lng": -73.9970}
    far = [{"tags": {"name": "Starbucks", "amenity": "cafe"}, "lat": 40.7500, "lon": -73.9970}]
    assert rc.match_osm(pin, far) is None


def test_match_falls_back_to_coordinates():
    pin = {"name": "Cafe Renamed Since Import", "lat": 40.7300, "lng": -73.9970}
    elements = [{"tags": {"name": "Cafe Old Name", "amenity": "cafe"}, "lat": 40.73005, "lon": -73.99702}]
    assert rc.match_osm(pin, elements)["tags"]["name"] == "Cafe Old Name"


def test_rows_skip_non_food_and_rank_callable_first():
    pins = [
        {"id": "a", "name": "No Phone Diner", "lat": 40.73, "lng": -73.997, "categories": ["group-food"]},
        {"id": "b", "name": "Phone Diner", "lat": 40.731, "lng": -73.997, "categories": ["group-food"]},
        {"id": "c", "name": "Butler Library", "lat": 40.732, "lng": -73.997, "categories": ["library"]},
    ]
    elements = [{"tags": {"name": "Phone Diner", "amenity": "restaurant", "phone": "+1 212 555 0100"},
                 "lat": 40.731, "lon": -73.997}]
    rows = rc.build_rows("nyu", pins, elements)
    assert [r["name"] for r in rows] == ["Phone Diner", "No Phone Diner"], rows
    assert "_rank" not in rows[0]


def test_site_check_reports_events_but_never_a_number():
    """The trap this guards: a catering tray's "serves 12-14 guests" or a booking form's
    "8+ People" dropdown read as a venue capacity. Site reading answers yes/no only."""
    page = ("Welcome to our restaurant. Private dining available for your celebration. "
            "Each tray serves approximately 12-14 guests. Party size: 8+ People.")
    row = {"website": "https://example.com", "site mentions events": "", "events page": "",
           "site says": ""}
    original = rc.fetch_text
    rc.fetch_text = lambda url, timeout=12: ((page, "<html>" + page + "</html>"), url)
    try:
        rc.check_site(row)
    finally:
        rc.fetch_text = original
    assert row["site mentions events"] == "yes"
    assert "Private dining" in row["site says"]
    assert "MAX GROUP" not in row and "capacity" not in row, "site reading must never set a capacity"


def test_site_check_survives_a_dead_website():
    row = {"website": "https://does-not-resolve.invalid", "site mentions events": "",
           "events page": "", "site says": ""}
    original = rc.fetch_text

    def boom(url, timeout=12):
        raise OSError("connection refused")

    rc.fetch_text = boom
    try:
        rc.check_site(row)
    finally:
        rc.fetch_text = original
    assert row["site mentions events"] == ""


def test_import_reads_answers_and_leaves_blanks_alone():
    """The point of the blanks: an unanswered call must not become a number on the live map."""
    rows = [
        {"campus": "nyu", "id": "kept", "name": "Kept", "RENTAL (y/n/partial)": "y", "MAX GROUP": "up to 25 seated"},
        {"campus": "nyu", "id": "blank", "name": "Nobody Answered", "RENTAL (y/n/partial)": "", "MAX GROUP": ""},
        {"campus": "nyu", "id": "vague", "name": "Vague", "RENTAL (y/n/partial)": "", "MAX GROUP": "a lot?"},
        {"campus": "", "id": "", "name": "^^ instructions row ^^", "RENTAL (y/n/partial)": "", "MAX GROUP": ""},
    ]
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "calls.csv")
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=rc.COLUMNS)
            w.writeheader()
            for row in rows:
                w.writerow({c: row.get(c, "") for c in rc.COLUMNS})
        answers = rc.read_answers(path)
    assert answers[("nyu", "kept")] == (25, "Takes private group bookings")
    assert ("nyu", "blank") not in answers
    assert ("nyu", "vague") not in answers, "a MAX GROUP with no number must not become a capacity"


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print(f"ok  {name}")
    print("All checks passed.")
