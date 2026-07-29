#!/usr/bin/env python3
"""Build the phone-call list for "can we book this place for a group, and how many fit?"

Why this is a phone pass and not a script: OpenStreetMap does not publish venue capacity or
private-event policy. A check of the 1,606 food venues within 1200m of NYU found 2 with any
capacity tag (one of them wrong) and 24 mapped as building outlines rather than single points —
so there is nothing to estimate from, by tag or by floor area. Both numbers a group trip needs
live in one place only: the manager, on the phone.

What the script does do is remove the busywork around the call. It pulls the phone number, email,
website and reservation policy OSM does carry, matches them to our existing group-food pins, and
sorts so the venues worth calling are at the top of the sheet.

    python3 scripts/rental_calls.py --export              # write the call list
    python3 scripts/rental_calls.py --export --check-sites  # ...and read each venue's own site
    # ... humans work the phones, fill the sheet in Google Sheets, save back over the file ...
    python3 scripts/rental_calls.py --import-results      # sheet -> capacity + rental on the pins

Only two columns are read back: MAX GROUP fills each pin's `capacity`, RENTAL fills `rental`.
Blank rows are left alone, so a half-worked sheet imports safely and can be imported again later.
"""
import argparse
import csv
import json
import math
import os
import concurrent.futures
import html
import re
import sys
import urllib.parse
import urllib.request
import urllib.robotparser

CSV_PATH = "docs/rental-calls.csv"
INDEX_PATH = "data/universities/index.json"
COLUMNS = ["RENTAL (y/n/partial)", "MAX GROUP", "MIN SPEND / DEPOSIT", "NOTES",
           "campus", "name", "type", "phone", "email", "website", "takes reservations",
           "site mentions events", "events page", "site says", "chain", "current capacity",
           "hours", "look up", "id"]

# Same endpoint list and User-Agent as find_nearby_pins.py — the first two are faster when
# healthy, the third is the one that stays up when they aren't.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
FOOD_AMENITIES = "restaurant|cafe|fast_food|bar|pub|ice_cream"

# A place you can walk into and sit down can host a group; a counter you order at from the
# pavement can't. Sorts the sheet so the first calls are the ones most likely to pay off.
TYPE_RANK = {"restaurant": 0, "pub": 1, "bar": 1, "cafe": 2, "fast_food": 3, "ice_cream": 3}

STANDARD_ROW = {c: "" for c in COLUMNS}
STANDARD_ROW.update({
    "NOTES": "WHAT TO ASK, in this order: (1) Do you take private bookings or reserve a section "
             "for a group? (2) What is the largest group you will seat at one table or in one "
             "area? That number goes in MAX GROUP — it is the number of seats they will actually "
             "give us, NOT the fire-code occupancy of the room. (3) Is there a minimum spend, "
             "deposit or set menu? (4) How far ahead do we book? "
             "RENTAL: y = will host a private/reserved group, partial = large table only, no "
             "private space, n = walk-ins only. Leave the row blank if nobody picked up — a "
             "guess here ends up on the live map as if someone confirmed it.",
    "name": "^^ READ THIS FIRST — do not fill this row ^^",
})


def query_overpass(lat, lng, radius_m):
    query = f"""
[out:json][timeout:90];
(
  node["amenity"~"^({FOOD_AMENITIES})$"](around:{radius_m},{lat},{lng});
  way["amenity"~"^({FOOD_AMENITIES})$"](around:{radius_m},{lat},{lng});
);
out center tags;
"""
    data = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint, data=data,
                headers={"User-Agent": "nyc-campus-hub-research-script/1.0 (offline content authoring tool)"}
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read()).get("elements", [])
        except Exception as e:
            last_error = e
            print(f"  [warn] {endpoint} failed: {e}", file=sys.stderr)
    raise RuntimeError(f"All Overpass endpoints failed. Last error: {last_error}")


# --- Reading the venue's own website -------------------------------------------------------
#
# Only ever answers "do they mention hosting groups at all", never how many fit. A sample of 20
# venue sites found 7 advertising private events and ZERO stating a capacity — and the only two
# numbers on any page were a catering tray's serving size and a reservation form's "8+ People"
# dropdown, both of which a number-scraper would have written down as a capacity. Restaurants
# publish an enquiry form instead of a number on purpose, because the real answer depends on the
# date and the spend. So this narrows the call list; it does not shorten the call.

EVENT_WORDS = re.compile(
    r"private (?:event|dining|part(?:y|ies)|room)s?|group (?:dining|booking|reservation)s?"
    r"|buyouts?|large part(?:y|ies)|banquet|semi-private", re.I)
EVENT_LINK = re.compile(r"private|event|part(?:y|ies)|group|banquet", re.I)
FETCH_HEADERS = {"User-Agent": "nyc-campus-hub-research-script/1.0 (offline content authoring tool)"}


def allowed_by_robots(url):
    """Ask the site's robots.txt first. It's their server and one line of stdlib to be polite."""
    try:
        parts = urllib.parse.urlsplit(url)
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(f"{parts.scheme}://{parts.netloc}/robots.txt")
        parser.read()
        return parser.can_fetch(FETCH_HEADERS["User-Agent"], url)
    except Exception:
        return True  # no readable robots.txt means no rule against it


def fetch_text(url, timeout=12):
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    if not allowed_by_robots(url):
        return None, url
    with urllib.request.urlopen(urllib.request.Request(url, headers=FETCH_HEADERS), timeout=timeout) as resp:
        raw = resp.read(600_000).decode("utf-8", "replace")
    stripped = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", stripped)))
    return (text, raw), url


def check_site(row):
    """Fill in whether the venue's own site says it hosts groups, and quote where it says so."""
    if not row["website"]:
        return row
    try:
        result = fetch_text(row["website"])[0]
    except Exception:
        return row  # dead link, timeout, cert error — a blank column, not a crashed run
    if not result:
        return row
    text, raw = result
    pages = [text]
    for match in re.finditer(r'href=["\']([^"\']+)["\']', raw, re.I):
        link = match.group(1)
        if EVENT_LINK.search(link) and not link.startswith(("mailto", "tel", "#", "javascript")):
            if link.startswith("/"):
                link = row["website"].rstrip("/") + link
            try:
                more = fetch_text(link)[0]
                if more:
                    pages.append(more[0])
                    row["events page"] = link
            except Exception:
                pass
            break
    for page in pages:
        found = EVENT_WORDS.search(page)
        if found:
            row["site mentions events"] = "yes"
            # The quote, not just the verdict — so a reviewer can see what it was based on
            # rather than trusting a yes from a regex.
            row["site says"] = page[max(0, found.start() - 60):found.end() + 60].strip()
            break
    return row


def check_sites(rows):
    checked = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for row in pool.map(check_site, rows):
            checked += row["site mentions events"] == "yes"
    print(f"  {checked} of {len(rows)} sites advertise private events or group bookings.")
    return rows


def meters_between(lat1, lng1, lat2, lng2):
    """Flat-earth approximation — fine at the scale of a few city blocks."""
    lat_m = (lat1 - lat2) * 111320
    lng_m = (lng1 - lng2) * 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(lat_m, lng_m)


def normalise(name):
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def element_latlng(el):
    if "lat" in el:
        return el["lat"], el["lon"]
    center = el.get("center") or {}
    return center.get("lat"), center.get("lng") or center.get("lon")


def match_osm(pin, elements):
    """Find the OSM entry a pin came from: same name, or the nearest food venue on top of it.

    Name first, because two restaurants can share a doorway and coordinates alone would pick the
    wrong one. Distance is still checked on the name match — a chain has the same name in twenty
    places and we want the branch by campus.
    """
    best, best_distance = None, None
    target = normalise(pin["name"])
    for el in elements:
        lat, lng = element_latlng(el)
        if lat is None:
            continue
        distance = meters_between(pin["lat"], pin["lng"], lat, lng)
        same_name = normalise(el.get("tags", {}).get("name")) == target
        limit = 150 if same_name else 25
        if distance > limit:
            continue
        # A name match always beats a bare coordinate match, however close the latter is.
        rank = (0 if same_name else 1, distance)
        if best is None or rank < best_distance:
            best, best_distance = el, rank
    return best


def build_rows(campus, pins, elements):
    rows = []
    for pin in pins:
        if "group-food" not in pin.get("categories", []):
            continue
        tags = (match_osm(pin, elements) or {}).get("tags", {})
        phone = tags.get("phone") or tags.get("contact:phone", "")
        amenity = tags.get("amenity", "")
        rows.append({
            "RENTAL (y/n/partial)": "", "MAX GROUP": "", "MIN SPEND / DEPOSIT": "", "NOTES": "",
            "campus": campus,
            "name": pin["name"],
            "type": amenity,
            "phone": phone,
            "email": tags.get("email") or tags.get("contact:email", ""),
            "website": tags.get("website") or tags.get("contact:website") or pin.get("contactUrl", ""),
            "takes reservations": tags.get("reservation", ""),
            "site mentions events": "", "events page": "", "site says": "",
            "chain": "yes" if tags.get("brand") else "",
            "current capacity": pin.get("capacity", ""),
            "hours": pin.get("hours", ""),
            "look up": f'https://www.google.com/maps/search/?api=1&query={pin["lat"]},{pin["lng"]}',
            "id": pin["id"],
            # Sort key only — dropped before writing.
            "_rank": (0 if phone else 1, TYPE_RANK.get(amenity, 4),
                      0 if tags.get("reservation") else 1, pin["name"].lower()),
        })
    rows.sort(key=lambda r: r["_rank"])
    for row in rows:
        del row["_rank"]
    return rows


def count_filled():
    """How much call work the existing sheet already holds, so --export can't quietly eat it."""
    if not os.path.exists(CSV_PATH):
        return 0
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        return sum(1 for row in csv.DictReader(f)
                   if row.get("campus") and (
                       (row.get("RENTAL (y/n/partial)") or "").strip()
                       or (row.get("MAX GROUP") or "").strip()
                       or (row.get("NOTES") or "").strip()))


def export(limit, radius, force, check_websites):
    filled = count_filled()
    if filled and not force:
        sys.exit(f"{CSV_PATH} already has {filled} row(s) filled in. Exporting would throw that "
                 f"work away. Move the file somewhere safe first, or pass --force.")

    rows = []
    for uni in json.load(open(INDEX_PATH)):
        campus = uni["id"]
        lat, lng = uni["mapCenter"]
        print(f"Querying OpenStreetMap for food venues within {radius}m of {campus}...")
        elements = query_overpass(lat, lng, radius)
        print(f"  {len(elements)} venues back from OSM.")
        pins = json.load(open(f"data/universities/{campus}-map.json"))
        campus_rows = build_rows(campus, pins, elements)
        with_phone = sum(1 for r in campus_rows if r["phone"])
        print(f"  {len(campus_rows)} group-food pins, {with_phone} with a phone number.")
        campus_rows = campus_rows[:limit]  # only read the sites of venues that made the cut
        if check_websites:
            print(f"  Reading {len(campus_rows)} venue websites...")
            check_sites(campus_rows)
            # Stable, so everything else keeps the order build_rows already put it in.
            campus_rows.sort(key=lambda r: r["site mentions events"] != "yes")
        rows.extend(campus_rows)

    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerow(STANDARD_ROW)
        writer.writerows(rows)
    print(f"\nWrote {len(rows)} rows to {CSV_PATH} (top {limit} per campus).")
    print("Open it in Google Sheets, freeze rows 1-2, and work down the list.")


RENTAL_ANSWERS = {
    "y": "Takes private group bookings", "yes": "Takes private group bookings",
    "partial": "Large table only — no private space",
    "n": "Walk-ins only — no group bookings", "no": "Walk-ins only — no group bookings",
}


def read_answers(path):
    """(campus, id) -> (capacity, rental) for every row somebody actually answered.

    A row nobody answered is left out entirely rather than imported as a zero or a blank: an
    unreturned phone call must not end up on the map looking like a confirmed number.
    """
    answers = {}
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if not row.get("campus") or not row.get("id"):
                continue  # the instructions row
            capacity = None
            raw = (row.get("MAX GROUP") or "").strip()
            if raw:
                digits = re.search(r"\d+", raw)
                if digits:
                    capacity = int(digits.group())
                else:
                    print(f"  [skip] {row['name']}: MAX GROUP {raw!r} has no number in it.")
            rental = RENTAL_ANSWERS.get((row.get("RENTAL (y/n/partial)") or "").strip().lower())
            if capacity is not None or rental is not None:
                answers[(row["campus"], row["id"])] = (capacity, rental)
    return answers


def import_results():
    if not os.path.exists(CSV_PATH):
        sys.exit(f"No {CSV_PATH} — run --export first.")

    answers = read_answers(CSV_PATH)
    if not answers:
        print("Nothing filled in yet — no changes.")
        return

    changed = 0
    for uni in json.load(open(INDEX_PATH)):
        campus = uni["id"]
        path = f"data/universities/{campus}-map.json"
        pins = json.load(open(path))
        touched = False
        for pin in pins:
            capacity, rental = answers.get((campus, pin["id"]), (None, None))
            if capacity is not None and pin.get("capacity") != capacity:
                pin["capacity"] = capacity
                touched = changed = True
            if rental is not None and pin.get("rental") != rental:
                pin["rental"] = rental
                touched = changed = True
        if touched:
            with open(path, "w") as f:
                json.dump(pins, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"Updated {path}.")
    if not changed:
        print("Every answer already matched what the pins say — nothing to write.")


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--export", action="store_true", help="write the call list")
    parser.add_argument("--import-results", action="store_true",
                        help="read the filled sheet back into the map pins")
    parser.add_argument("--limit", type=int, default=40,
                        help="how many venues per campus to put on the list (default 40)")
    parser.add_argument("--radius", type=int, default=1200,
                        help="how far from campus centre to look up phone numbers (default 1200m)")
    parser.add_argument("--check-sites", action="store_true",
                        help="also read each venue's own website for private-event mentions "
                             "(slower; never produces a capacity — no restaurant publishes one)")
    parser.add_argument("--force", action="store_true",
                        help="overwrite a call list that already has answers in it")
    args = parser.parse_args()

    if args.export == args.import_results:
        sys.exit("Pick one: --export or --import-results.")
    if args.export:
        export(args.limit, args.radius, args.force, args.check_sites)
    else:
        import_results()


if __name__ == "__main__":
    main()
