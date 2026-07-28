#!/usr/bin/env python3
"""Refresh a university's demographics and majors from the federal College Scorecard API.

WHY THIS IS AN OFFLINE SCRIPT AND NOT A fetch() IN THE APP
----------------------------------------------------------
The spec files demographics and majors under "auto-updating, no maintainer action needed", and
every other live source in this project (Open-Meteo, OpenStreetMap tiles) is callable straight
from the browser with no key. College Scorecard is not: it returns

    {"error": {"code": "API_KEY_MISSING", ...}}

without an api.data.gov key. Putting that key in app.js would ship it to every visitor of a
public, no-login site — the exact "paid/keyed API + exposed key" risk the spec rejected Google
Maps over. So the refresh runs here, on the maintainer's machine, with the key in an environment
variable, and commits the result as data. One command instead of an automatic update, but no
secret ever reaches the browser.

    export DATA_GOV_API_KEY=...            # free: https://api.data.gov/signup
    python3 scripts/refresh_scorecard.py --university columbia            # dry run, shows diff
    python3 scripts/refresh_scorecard.py --university columbia --write

On the first run for a school, add its Scorecard id to data/universities/<id>.json as
"scorecardId": <number>. Without one the script searches by name and prints the candidates
rather than guessing — "Columbia University" also matches Columbia College Chicago.

NOTE: the field paths below were read from the API's own response shape, not hardcoded from the
data dictionary — the script fetches the whole record and navigates it, so a renamed leaf shows
up as a clear "field missing" message instead of silently writing nothing.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request

BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"

# Scorecard reports majors as CIP 2-digit shares under latest.academics.program_percentage.
# These are the labels already in the data files; anything not listed falls back to a
# prettified key so a new category shows up rather than being dropped.
CIP_LABELS = {
    "social_science": "Social Sciences",
    "computer": "Computer & Information Sciences",
    "engineering": "Engineering",
    "biological": "Biological Sciences",
    "english": "English Language & Literature",
    "visual_performing": "Visual & Performing Arts",
    "multidiscipline": "Multi/Interdisciplinary Studies",
    "psychology": "Psychology",
    "mathematics": "Mathematics & Statistics",
    "history": "History",
    "business_marketing": "Business & Marketing",
    "health": "Health Professions",
    "communication": "Communication & Journalism",
    "physical_science": "Physical Sciences",
    "education": "Education",
    "philosophy_religious": "Philosophy & Religious Studies",
    "public_administration": "Public Administration & Social Service",
    "architecture": "Architecture",
    "language": "Foreign Languages & Linguistics",
    "area_ethnic_cultural_gender": "Area, Ethnic & Gender Studies",
}


def api_get(params):
    key = os.environ.get("DATA_GOV_API_KEY")
    if not key:
        sys.exit("DATA_GOV_API_KEY is not set. Get a free key at https://api.data.gov/signup "
                 "and export it before running.")
    url = BASE + "?" + urllib.parse.urlencode(dict(params, api_key=key))
    req = urllib.request.Request(url, headers={"User-Agent": "nyc-campus-hub-research-script/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:400]
        sys.exit(f"College Scorecard returned HTTP {e.code}:\n{body}")


def dig(record, path):
    """Walk a dotted path, returning None rather than raising if any step is missing."""
    node = record
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node


def pct(value):
    """Scorecard reports shares as 0–1 floats; the app stores percentages."""
    return None if value is None else round(value * 100, 1)


def find_by_name(name):
    data = api_get({"school.name": name, "fields": "id,school.name,school.city,school.state",
                    "per_page": 20})
    return data.get("results", [])


def fetch_record(scorecard_id):
    # No `fields` filter on purpose: taking the whole record means the leaf names come from the
    # API rather than from an assumption in this file.
    data = api_get({"id": scorecard_id, "per_page": 1})
    results = data.get("results", [])
    if not results:
        sys.exit(f"No school with Scorecard id {scorecard_id}.")
    return results[0]


def extract(record):
    """Pull the fields the app shows. Returns (values, list of missing field paths)."""
    paths = {
        "undergrad": "latest.student.size",
        "womenPct": "latest.student.demographics.women",
        "internationalPct": "latest.student.demographics.race_ethnicity.non_resident_alien",
    }
    values, missing = {}, []
    for field, path in paths.items():
        raw = dig(record, path)
        if raw is None:
            missing.append(path)
            continue
        values[field] = raw if field == "undergrad" else pct(raw)

    programs = dig(record, "latest.academics.program_percentage")
    if not isinstance(programs, dict):
        missing.append("latest.academics.program_percentage")
    else:
        ranked = sorted(((v, k) for k, v in programs.items() if v),
                        reverse=True)[:10]
        values["majors"] = [
            {"label": CIP_LABELS.get(k, k.replace("_", " ").title()), "pct": pct(v)}
            for v, k in ranked
        ]
    return values, missing


def splice_number(text, key, value):
    pattern = re.compile(r'("%s"\s*:\s*)(-?\d+(?:\.\d+)?)' % re.escape(key))
    if not pattern.search(text):
        raise ValueError(f'no numeric "{key}" in file')
    return pattern.sub(lambda m: m.group(1) + json.dumps(value), text, count=1)


def splice_majors(text, majors):
    """Replace the whole majors array, matching the file's existing one-object-per-line style."""
    match = re.search(r'("majors"\s*:\s*\[)(.*?)(\n  \])', text, re.S)
    if not match:
        raise ValueError('no "majors" array in file')
    body = "\n" + ",\n".join(
        '    { "label": %s, "pct": %s }' % (json.dumps(m["label"], ensure_ascii=False), m["pct"])
        for m in majors)
    return text[:match.start(2)] + body + text[match.end(2):]


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--university", required=True, help="university id, e.g. columbia")
    parser.add_argument("--write", action="store_true", help="apply changes (default: dry run)")
    args = parser.parse_args()

    path = f"data/universities/{args.university}.json"
    if not os.path.exists(path):
        sys.exit(f"No such file: {path}")
    live = json.load(open(path))

    scorecard_id = live.get("scorecardId")
    if not scorecard_id:
        print(f'No "scorecardId" in {path}. Searching by name — add the right id to that file '
              f"and re-run.\n")
        for hit in find_by_name(live["name"]):
            print(f'  {hit["id"]:>8}  {hit["school.name"]} '
                  f'({hit.get("school.city", "?")}, {hit.get("school.state", "?")})')
        return

    record = fetch_record(scorecard_id)
    values, missing = extract(record)
    for field in missing:
        print(f"  [warn] not present in the API response: {field}", file=sys.stderr)
    if not values:
        sys.exit("Nothing usable came back — refusing to write.")

    print(f"{live['name']} (Scorecard id {scorecard_id}):")
    for field in ("undergrad", "womenPct", "internationalPct"):
        if field in values:
            print(f"  {field:18} {live['demographics'].get(field)}  ->  {values[field]}")
    if "majors" in values:
        print("  majors:")
        for old, new in zip(live["majors"] + [None] * 10, values["majors"]):
            was = f'{old["label"]} {old["pct"]}%' if old else "—"
            print(f'    {was:48} ->  {new["label"]} {new["pct"]}%')

    # Graduate enrolment is deliberately untouched: Scorecard's student.size is undergraduate
    # only, and the existing graduate figures came from each university's own reporting.
    print("\n  graduate count and its source note are left alone — not a Scorecard field.")

    if not args.write:
        print("\nDry run — nothing written. Re-run with --write to apply.")
        return

    text = open(path).read()
    for field in ("undergrad", "womenPct", "internationalPct"):
        if field in values:
            text = splice_number(text, field, values[field])
    if "majors" in values:
        text = splice_majors(text, values["majors"])
    json.loads(text)
    open(path, "w").write(text)
    print(f"\nUpdated {path}. Check the demographics `source` note still describes where "
          f"these came from.")


if __name__ == "__main__":
    main()
