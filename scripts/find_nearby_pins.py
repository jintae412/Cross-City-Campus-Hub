#!/usr/bin/env python3
"""Find real nearby points of interest via OpenStreetMap's Overpass API and write them
to a review-queue file (data/universities/<university>-map-suggestions.json).

This never touches the live map data. Everything it writes is tagged aiSuggested/
reviewed:false — a human must check each entry and merge accepted ones into
data/universities/<university>-map.json by hand. See docs/intent/nyc-campus-hub.md
for why: AI-drafted content is never auto-published.

Built-in first-pass filtering (so review time goes to judgment calls, not cleanup):
  - Chain detection: entries with an OSM "brand" tag are flagged chain:true rather
    than dropped — a reviewer may still want a reliable chain option for a group.
  - Religion filter: --religion restricts place_of_worship results server-side
    (e.g. --religion christian), since amenity=place_of_worship alone matches any faith.
  - Proximity de-duplication: OSM sometimes maps the same physical spot twice (once as
    a node, once as part of a building way). Entries within --dedupe-radius meters of
    each other are merged, keeping whichever has more complete data.

Example (restaurants within a 15-minute walk of Columbia):
    python3 scripts/find_nearby_pins.py \\
        --university columbia --lat 40.807 --lng -73.962 --radius 1200 \\
        --tag amenity=restaurant --category group-food

Example (Christian churches only):
    python3 scripts/find_nearby_pins.py \\
        --university columbia --lat 40.807 --lng -73.962 --radius 1200 \\
        --tag amenity=place_of_worship --category church --religion christian
"""
import argparse
import json
import math
import os
import sys
import urllib.parse
import urllib.request

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def query_overpass(tag_filter, lat, lng, radius_m, religion=None):
    key, value = tag_filter.split("=", 1)
    extra = f'["religion"="{religion}"]' if religion else ""
    query = f"""
[out:json][timeout:30];
(
  node["{key}"="{value}"]{extra}(around:{radius_m},{lat},{lng});
  way["{key}"="{value}"]{extra}(around:{radius_m},{lat},{lng});
);
out center tags;
"""
    data = urllib.parse.urlencode({"data": query}).encode()
    last_error = None
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            req = urllib.request.Request(
                endpoint,
                data=data,
                headers={"User-Agent": "nyc-campus-hub-research-script/1.0 (offline content authoring tool)"}
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.loads(resp.read())
        except Exception as e:
            last_error = e
            print(f"  [warn] {endpoint} failed: {e}", file=sys.stderr)
    raise RuntimeError(f"All Overpass endpoints failed. Last error: {last_error}")


def element_latlng(el):
    if "lat" in el and "lon" in el:
        return el["lat"], el["lon"]
    center = el.get("center")
    if center:
        return center["lat"], center["lon"]
    return None, None


def to_pin(el, category):
    lat, lng = element_latlng(el)
    if lat is None:
        return None
    tags = el.get("tags", {})
    name = tags.get("name")
    if not name:
        return None  # unnamed features aren't useful on the map
    website = tags.get("website") or tags.get("contact:website")
    opening_hours = tags.get("opening_hours")
    return {
        "name": name,
        "categories": [category],
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "hours": opening_hours or "NEEDS REVIEW — hours not available from OpenStreetMap, verify manually",
        "contactUrl": website,
        "chain": bool(tags.get("brand")),
        "source": "OpenStreetMap via Overpass API",
        "aiSuggested": True,
        "reviewed": False
    }


def meters_between(lat1, lng1, lat2, lng2):
    """Flat-earth approximation — fine at the scale of a few city blocks."""
    lat_m = (lat1 - lat2) * 111320
    lng_m = (lng1 - lng2) * 111320 * math.cos(math.radians((lat1 + lat2) / 2))
    return math.hypot(lat_m, lng_m)


def completeness_score(pin):
    score = 0
    if pin.get("contactUrl"):
        score += 1
    if not str(pin.get("hours", "")).startswith("NEEDS REVIEW"):
        score += 1
    return score


def dedupe(pins, radius_m):
    """Merge entries within radius_m of each other, keeping the more complete one."""
    kept = []
    for pin in pins:
        match = None
        for existing in kept:
            if meters_between(pin["lat"], pin["lng"], existing["lat"], existing["lng"]) <= radius_m:
                match = existing
                break
        if match is None:
            kept.append(pin)
        elif completeness_score(pin) > completeness_score(match):
            kept.remove(match)
            kept.append(pin)
    return kept


def main():
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--university", required=True, help="university id, e.g. columbia")
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--lng", type=float, required=True)
    parser.add_argument("--radius", type=int, default=1200,
                         help="search radius in meters (default 1200m, roughly a 15 min walk)")
    parser.add_argument("--tag", required=True,
                         help='OSM tag to search, as key=value, e.g. amenity=restaurant')
    parser.add_argument("--category", required=True,
                         help="category label to assign in our schema, e.g. group-food")
    parser.add_argument("--religion", default=None,
                         help='restrict place_of_worship results to this OSM religion= value, e.g. christian')
    parser.add_argument("--dedupe-radius", type=int, default=15,
                         help="merge results within this many meters of each other (default 15)")
    args = parser.parse_args()

    print(f"Querying OpenStreetMap for {args.tag} within {args.radius}m of ({args.lat}, {args.lng})"
          + (f" [religion={args.religion}]" if args.religion else "") + "...")
    result = query_overpass(args.tag, args.lat, args.lng, args.radius, args.religion)
    elements = result.get("elements", [])
    print(f"Found {len(elements)} raw results.")

    pins = []
    seen_names = set()
    for el in elements:
        pin = to_pin(el, args.category)
        if pin and pin["name"] not in seen_names:
            seen_names.add(pin["name"])
            pins.append(pin)

    out_path = f"data/universities/{args.university}-map-suggestions.json"
    existing = []
    if os.path.exists(out_path):
        with open(out_path) as f:
            existing = json.load(f)

    existing_names = {p["name"] for p in existing}
    new_pins = [p for p in pins if p["name"] not in existing_names]

    combined = dedupe(existing + new_pins, args.dedupe_radius)
    chains = sum(1 for p in combined if p.get("chain"))

    with open(out_path, "w") as f:
        json.dump(combined, f, indent=2)
        f.write("\n")

    print(f"{len(new_pins)} new candidate(s) found; {len(combined)} total after de-duplication "
          f"({chains} flagged as chains).")
    print("Nothing here is live yet — review this file and merge accepted entries into "
          f"data/universities/{args.university}-map.json by hand.")


if __name__ == "__main__":
    main()
