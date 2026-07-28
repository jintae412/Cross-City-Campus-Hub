#!/usr/bin/env python3
"""Validate and merge the offline content review queue into a university's live data file.

Companion to scripts/authoring-prompt.md. Reads
data/universities/<id>-content-suggestions.json and, only for entries explicitly marked
"reviewed": true, splices them into data/universities/<id>.json.

The security boundary from docs/intent/nyc-campus-hub.md — nothing AI-drafted reaches the
live site without human review — is enforced here rather than left to discipline: unreviewed
entries are never merged, and entries missing a source are rejected outright even if marked
reviewed, because "I reviewed it" is not checkable but "it cites something" is.

Default run validates and reports, changing nothing. Pass --merge to write.

    python3 scripts/review_content.py --university columbia
    python3 scripts/review_content.py --university columbia --merge
    python3 scripts/review_content.py --self-check
"""
import argparse
import datetime
import json
import os
import re
import sys

SECTIONS = ("culture", "traditions", "calendar")


def problems_with(section, entry):
    """Return a list of reasons this entry can't be merged. Empty list = mergeable."""
    issues = []
    if not entry.get("source"):
        issues.append("no source")

    if section == "calendar":
        if not entry.get("label"):
            issues.append("no label")
        date = entry.get("date")
        if date is not None:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date)):
                issues.append(f"date {date!r} is not YYYY-MM-DD or null")
            else:
                try:
                    datetime.date.fromisoformat(date)
                except ValueError:
                    issues.append(f"date {date!r} is not a real date")
        if not isinstance(entry.get("verified"), bool):
            issues.append("verified must be true or false")
    elif not entry.get("text"):
        issues.append("no text")

    return issues


def live_value(section, entry):
    """Strip the review metadata — the live schema doesn't carry it."""
    if section == "calendar":
        return {"date": entry.get("date"), "label": entry["label"], "verified": entry["verified"]}
    return entry["text"]


def find_array(text, key):
    """Byte range of the array body for "<key>": [ ... ], or None. Bracket-counted rather
    than regexed, since labels and sources legitimately contain brackets."""
    match = re.search(r'"%s"\s*:\s*\[' % re.escape(key), text)
    if not match:
        return None
    depth, i = 1, match.end()
    while i < len(text) and depth:
        char = text[i]
        if char == '"':  # skip strings whole; escaped quotes included
            i += 1
            while i < len(text) and text[i] != '"':
                i += 2 if text[i] == "\\" else 1
        elif char in "[{":
            depth += 1
        elif char in "]}":
            depth -= 1
        i += 1
    return (match.end(), i - 1)


def splice_into_array(text, key, entries, indent="    "):
    """Append entries to an existing JSON array in `text`, leaving the rest byte-identical.

    A json.load/json.dump round-trip reformats the whole file — it reflows the hand-written
    inline `majors` objects and buries the real change in cosmetic diff. Same reason the map
    merges splice (see docs/intent/map-expansion-status.md)."""
    span = find_array(text, key)
    if span is None:
        raise ValueError(f'no "{key}" array in file')
    start, end = span
    body = text[start:end]
    rendered = [
        json.dumps(e, ensure_ascii=False).replace("{", "{ ", 1)[:-1] + " }"
        if isinstance(e, dict) else json.dumps(e, ensure_ascii=False)
        for e in entries
    ]
    addition = "".join(f",\n{indent}{r}" for r in rendered)
    if not body.strip():  # empty array — no leading comma, and open it up
        addition = "\n" + ",\n".join(f"{indent}{r}" for r in rendered) + "\n  "
        return text[:start] + addition + text[end:]
    if "\n" not in body:  # written inline, e.g. "traditions" — keep it that way
        return text[:start] + body.rstrip() + ", " + ", ".join(rendered) + text[end:]
    return text[:start] + body.rstrip() + addition + "\n  " + text[end:]


def replace_string_value(text, key, value):
    """Replace a top-level "<key>": "..." string value in place."""
    pattern = re.compile(r'("%s"\s*:\s*)"(?:[^"\\]|\\.)*"' % re.escape(key))
    if not pattern.search(text):
        raise ValueError(f'no "{key}" string in file')
    return pattern.sub(lambda m: m.group(1) + json.dumps(value, ensure_ascii=False), text, count=1)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--university", help="university id, e.g. columbia")
    parser.add_argument("--merge", action="store_true",
                        help="write accepted entries into the live file (default: report only)")
    parser.add_argument("--self-check", action="store_true", help="run assertions and exit")
    args = parser.parse_args()

    if args.self_check:
        self_check()
        return
    if not args.university:
        parser.error("--university is required")

    queue_path = f"data/universities/{args.university}-content-suggestions.json"
    live_path = f"data/universities/{args.university}.json"
    if not os.path.exists(queue_path):
        sys.exit(f"No review queue at {queue_path}. See scripts/authoring-prompt.md.")

    queue = json.load(open(queue_path))
    live = json.load(open(live_path))
    accepted, skipped, rejected = {}, 0, []

    for section in SECTIONS:
        for entry in queue.get(section, []):
            if entry.get("reviewed") is not True:
                skipped += 1
                continue
            issues = problems_with(section, entry)
            if issues:
                rejected.append((section, entry, issues))
                continue
            accepted.setdefault(section, []).append(entry)

    # Duplicates against what's already live, so a re-run doesn't double-add.
    existing = {
        "traditions": set(live.get("traditions", [])),
        "calendar": {(e.get("date"), e.get("label")) for e in live.get("calendar", [])},
    }
    for section in ("traditions", "calendar"):
        kept = []
        for entry in accepted.get(section, []):
            key = (entry.get("date"), entry["label"]) if section == "calendar" else entry["text"]
            if key in existing[section]:
                print(f"  already live, skipping: {key}")
            else:
                kept.append(entry)
        if section in accepted:
            accepted[section] = kept

    for section, entry, issues in rejected:
        label = entry.get("label") or entry.get("text", "")
        print(f"REJECTED [{section}] {label[:50]!r}: {'; '.join(issues)}", file=sys.stderr)

    counts = {s: len(v) for s, v in accepted.items() if v}
    print(f"{sum(counts.values())} mergeable {counts}, {skipped} not marked reviewed, "
          f"{len(rejected)} rejected")

    if not args.merge:
        print("Report only — nothing written. Re-run with --merge to apply.")
        return
    if rejected:
        sys.exit("Refusing to merge while entries are rejected — fix or remove them first.")
    if not counts:
        print("Nothing to merge.")
        return

    text = open(live_path).read()
    for section in ("traditions", "calendar"):
        if accepted.get(section):
            text = splice_into_array(
                text, section, [live_value(section, e) for e in accepted[section]])
    if accepted.get("culture"):
        entry = accepted["culture"][-1]
        print(f"\n  culture is a single value — replacing:\n    old: {live['culture'][:90]}"
              f"\n    new: {entry['text'][:90]}")
        text = replace_string_value(text, "culture", entry["text"])

    json.loads(text)  # never write a file we just broke
    open(live_path, "w").write(text)
    print(f"Merged into {live_path}.")


def self_check():
    assert problems_with("calendar", {"source": "x", "label": "L", "date": None,
                                      "verified": False}) == []
    assert problems_with("calendar", {"label": "L", "date": None, "verified": True}) == ["no source"]
    assert "not a real date" in " ".join(
        problems_with("calendar", {"source": "x", "label": "L", "date": "2026-02-30",
                                   "verified": True}))
    assert "YYYY-MM-DD" in " ".join(
        problems_with("calendar", {"source": "x", "label": "L", "date": "Aug 28",
                                   "verified": True}))
    assert problems_with("traditions", {"source": "x", "text": "Orgo Night"}) == []
    assert problems_with("traditions", {"source": "x"}) == ["no text"]

    # Splice leaves everything outside the target array byte-identical.
    original = ('{\n  "culture": "old [draft]",\n  "traditions": [\n    "A"\n  ],\n'
                '  "calendar": [\n    { "date": null, "label": "X", "verified": false }\n  ]\n}\n')
    out = splice_into_array(original, "traditions", ["B"])
    assert json.loads(out)["traditions"] == ["A", "B"], out
    assert json.loads(out)["calendar"] == json.loads(original)["calendar"]
    assert '"culture": "old [draft]"' in out  # brackets in strings don't confuse the scan

    out = splice_into_array(original, "calendar",
                            [{"date": "2026-08-28", "label": "Move-In", "verified": True}])
    assert len(json.loads(out)["calendar"]) == 2
    assert json.loads(out)["calendar"][1]["label"] == "Move-In"

    empty = '{\n  "traditions": [],\n  "calendar": []\n}\n'
    assert json.loads(splice_into_array(empty, "traditions", ["A"]))["traditions"] == ["A"]

    # An inline array stays inline rather than being half-exploded onto new lines.
    inline = '{\n  "traditions": ["A", "B"],\n  "calendar": []\n}\n'
    out = splice_into_array(inline, "traditions", ["C"])
    assert '"traditions": ["A", "B", "C"],' in out, out
    assert json.loads(out)["traditions"] == ["A", "B", "C"]

    out = replace_string_value(original, "culture", 'new "quoted" text')
    assert json.loads(out)["culture"] == 'new "quoted" text'
    assert json.loads(out)["traditions"] == ["A"]

    print("review_content.py: all assertions passed")


if __name__ == "__main__":
    main()
