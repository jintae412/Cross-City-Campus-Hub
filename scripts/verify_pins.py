#!/usr/bin/env python3
"""Manage the in-person verification pass over the map pins.

Two flags, two different claims:
  handResearched — a person built this pin from an official source (Columbia Housing's residence
                   list, NYU Eats' dining guide, real coordinate lookups) rather than the bulk
                   OpenStreetMap import. Decides who lands on the checklist. Not shown on the site.
  handVerified   — someone actually confirmed the place exists and is where we say. Currently
                   false for all 1,089 pins. This is what the site's "Hand-checked spots only"
                   filter shows, so it hides everything until this pass produces something.

    python3 scripts/verify_pins.py --export           # write the checklist
    # ... humans work through it in Google Sheets, save back over the same file ...
    python3 scripts/verify_pins.py --import-results   # CHECKED column -> handVerified

Only the CHECKED column is read. `y` sets handVerified true, `n` sets it false, and anything else
(blank, "?", a note to self) is left alone — so a half-finished pass is safe to import, and you
can import repeatedly as the sheet fills up.

Exporting refuses to overwrite a checklist with anything filled in, so a stray --export can't
throw away the review work.
"""
import argparse
import csv
import json
import os
import re
import sys

CSV_PATH = "docs/recommended-to-verify.csv"
CAMPUSES = ("columbia", "nyu")
COLUMNS = ["CHECKED (y/n)", "NOTES", "campus", "name", "categories", "hours", "capacity",
           "contact", "look up", "id"]

# Written into the sheet as the first row so the standard is in front of whoever is filling the
# column, not buried in a README nobody opens. It has no campus or id, so --import-results skips
# it even if someone types in it. Freeze rows 1-2 in Google Sheets to keep it on screen.
STANDARD_ROW = {
    "CHECKED (y/n)": "",
    "NOTES": "WHAT COUNTS AS CHECKED: someone went there in person, or called and spoke to the "
             "place, within the last ~6 months, AND confirmed all three — it exists, it is at "
             "the spot the map shows, and our listed hours are right. "
             "y = all three confirmed. n = closed, moved, or the pin is in the wrong place. "
             "Leave blank if not checked. A website or Street View is NOT enough — that is where "
             "this data already came from.",
    "campus": "", "name": "^^ READ THIS FIRST — do not fill this row ^^",
    "categories": "", "hours": "", "capacity": "", "contact": "", "look up": "", "id": "",
}


def rows_to_check():
    rows = []
    for campus in CAMPUSES:
        for pin in json.load(open(f"data/universities/{campus}-map.json")):
            if pin.get("handResearched") is not True:
                continue
            rows.append({
                "CHECKED (y/n)": "",
                "NOTES": "",
                "campus": campus,
                "name": pin["name"],
                "categories": ", ".join(pin["categories"]),
                "hours": pin.get("hours", ""),
                "capacity": pin.get("capacity", ""),
                "contact": pin.get("contactUrl", ""),
                "look up": f'https://www.google.com/maps/search/?api=1'
                           f'&query={pin["lat"]},{pin["lng"]}',
                "id": pin["id"],
            })
    return rows


def count_filled():
    """How much review work the existing file already holds, so --force can't silently eat it."""
    if not os.path.exists(CSV_PATH):
        return 0
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        return sum(1 for row in csv.DictReader(f)
                   if (row.get("CHECKED (y/n)") or "").strip()
                   or (row.get("NOTES") or "").strip())


def import_results():
    if not os.path.exists(CSV_PATH):
        sys.exit(f"No {CSV_PATH} — run --export first.")

    answers = {}
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            answer = (row.get("CHECKED (y/n)") or "").strip().lower()
            if answer in ("y", "yes", "n", "no"):
                answers[(row["campus"], row["id"])] = answer.startswith("y")

    if not answers:
        print("Nothing marked y or n yet — no changes.")
        return

    total = 0
    for campus in CAMPUSES:
        path = f"data/universities/{campus}-map.json"
        text = open(path).read()
        changed = 0
        for (row_campus, pin_id), confirmed in answers.items():
            if row_campus != campus:
                continue
            pattern = re.compile(
                r'("id":\s*"%s",(?:.|\n)*?"handVerified":\s*)(true|false)' % re.escape(pin_id))
            match = pattern.search(text)
            if not match:
                print(f"  [warn] no pin {pin_id} in {campus}", file=sys.stderr)
                continue
            if (match.group(2) == "true") != confirmed:
                text = text[:match.start(2)] + str(confirmed).lower() + text[match.end(2):]
                changed += 1
        if changed:
            json.loads(text)  # never write a file we just broke
            open(path, "w").write(text)
        print(f"{campus}: {changed} flag(s) changed")
        total += changed

    verified = {c: sum(1 for p in json.load(open(f"data/universities/{c}-map.json"))
                       if p.get("handVerified")) for c in CAMPUSES}
    print(f"\n{total} updated. Now showing under 'Hand-checked spots only': "
          + ", ".join(f"{c} {n}" for c, n in verified.items()))


def export(force):
    filled = count_filled()
    if filled and not force:
        sys.exit(f"{CSV_PATH} already exists with {filled} row(s) filled in. "
                 f"Import them first (--import-results), or re-run with --force to discard.")
    if filled:
        print(f"[warn] discarding {filled} filled-in row(s) from the existing checklist.",
              file=sys.stderr)

    rows = rows_to_check()
    os.makedirs(os.path.dirname(CSV_PATH), exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerow(STANDARD_ROW)
        writer.writerows(rows)

    by_campus = {}
    for row in rows:
        by_campus[row["campus"]] = by_campus.get(row["campus"], 0) + 1
    print(f"Wrote {len(rows)} pins to {CSV_PATH} "
          + ", ".join(f"{k} {v}" for k, v in sorted(by_campus.items())) + ".")
    print("Fill the CHECKED column with y or n in Google Sheets, save back as CSV, then:")
    print("  python3 scripts/verify_pins.py --import-results")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--export", action="store_true", help="write the checklist CSV")
    group.add_argument("--import-results", action="store_true", dest="import_results",
                       help="read the CHECKED column into handVerified")
    parser.add_argument("--force", action="store_true",
                        help="with --export, overwrite a checklist that has entries filled in")
    args = parser.parse_args()
    export(args.force) if args.export else import_results()


if __name__ == "__main__":
    main()
