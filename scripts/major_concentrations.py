#!/usr/bin/env python3
"""Fill in what each broad major category actually contains, from the federal completions data.

The "Top Majors" bars come from College Scorecard, which only publishes the broad 2-digit CIP
families — so "Social Sciences 26.9%" tells a prospective student nothing about whether that means
economics or anthropology. The 6-digit breakdown behind those families is published, just in a
different file: IPEDS Completions (survey C, table A), which lists every individual program at
every institution with the number of degrees awarded.

So unlike venue capacity, this one is a real lookup and not a phone call. The script downloads
that file, keeps the rows for our universities, groups the 6-digit programs under the 2-digit
family each belongs to, and writes them into the university's `majors` as a `concentrations` list.
The site shows them in a click-to-expand drawer under each bar.

    python3 scripts/major_concentrations.py            # show what it would write
    python3 scripts/major_concentrations.py --write    # write it into the university files

Counted the same way Scorecard counts: bachelor's degrees only (award level 5), first majors only
(so a double major isn't counted twice), for the July 2022 - June 2023 award year. Percentages are
shares *within* the family, not of the whole university — a family's own bar already carries its
share of the whole, and the two datasets are different vintages, so adding them would invent a
precision neither one has.
"""
import argparse
import csv
import io
import json
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

YEAR = 2023
DATA_URL = f"https://nces.ed.gov/ipeds/datacenter/data/C{YEAR}_A.zip"
DICT_URL = f"https://nces.ed.gov/ipeds/datacenter/data/C{YEAR}_A_Dict.zip"
INDEX_PATH = "data/universities/index.json"
SOURCE = (f"U.S. Dept. of Education, IPEDS Completions {YEAR - 1}-{str(YEAR)[2:]} "
          f"(bachelor's degrees, first majors)")

# IPEDS codes for the things we care about. Both are code columns, not free text — "5" is a
# bachelor's degree and "1" is a first major, per the survey's own dictionary.
BACHELORS, FIRST_MAJOR = "5", "1"

# Our bar labels are hand-written, so they can't be matched to CIP families by name. This is the
# mapping, kept explicit: if a university adds a major category, add its 2-digit CIP family here
# or the category simply won't get a drawer.
CIP_FAMILIES = {
    "09": "Communication",
    "11": "Computer & Information Sciences",
    "14": "Engineering",
    "23": "English Language & Literature",
    "24": "Humanities",
    "26": "Biological Sciences",
    "27": "Mathematics & Statistics",
    "30": "Multi/Interdisciplinary Studies",
    "42": "Psychology",
    "45": "Social Sciences",
    "50": "Visual & Performing Arts",
    "51": "Health Professions",
    "52": "Business, Management & Marketing",
    "54": "History",
}
TOP_N = 6  # longer than this and the drawer stops being a summary


def download(url):
    print(f"  Downloading {url.rsplit('/', 1)[-1]}...")
    request = urllib.request.Request(url, headers={"User-Agent": "nyc-campus-hub-research-script/1.0"})
    with urllib.request.urlopen(request, timeout=300) as resp:
        return resp.read()


def sheet_rows(xlsx, sheet_number):
    """Read one sheet out of an .xlsx. An .xlsx is a zip of XML, so this needs no library —
    values are either inline or an index into a shared string table."""
    ns = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    shared = ["".join(t.text or "" for t in si.iter(ns + "t"))
              for si in ET.fromstring(xlsx.read("xl/sharedStrings.xml"))]
    for row in ET.fromstring(xlsx.read(f"xl/worksheets/sheet{sheet_number}.xml")).iter(ns + "row"):
        values = []
        for cell in row.iter(ns + "c"):
            value = cell.find(ns + "v")
            raw = "" if value is None else value.text
            values.append(shared[int(raw)] if cell.get("t") == "s" and raw else raw)
        yield values


def cip_names():
    """CIP code -> program name, from the survey's own dictionary (the 'Frequencies' sheet)."""
    dictionary = zipfile.ZipFile(io.BytesIO(download(DICT_URL)))
    inner = zipfile.ZipFile(io.BytesIO(dictionary.read(dictionary.namelist()[0])))
    names = {}
    for row in sheet_rows(inner, 4):
        if len(row) >= 4 and row[1] == "CIPCODE":
            names[row[2]] = row[3]
    if not names:
        raise RuntimeError("No CIP names found — IPEDS may have changed the dictionary layout.")
    print(f"  {len(names)} CIP program names.")
    return names


def completions():
    """(unitid, cipcode) -> degrees awarded, for bachelor's first majors only."""
    archive = zipfile.ZipFile(io.BytesIO(download(DATA_URL)))
    # The plain file, not the _RV revised one: _RV is a later restatement and is not always present.
    name = next(n for n in archive.namelist() if n.lower().endswith(".csv") and "_rv" not in n.lower())
    counts = {}
    with archive.open(name) as raw:
        for row in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace")):
            if row["AWLEVEL"] != BACHELORS or row["MAJORNUM"] != FIRST_MAJOR:
                continue
            if row["CIPCODE"] == "99":
                continue  # the institution's grand total, not a program
            try:
                total = int(row["CTOTALT"])
            except (TypeError, ValueError):
                continue
            if total > 0:
                counts[(row["UNITID"], row["CIPCODE"])] = total
    print(f"  {len(counts)} program rows across all institutions.")
    return counts


def concentrations_for(unitid, family_code, counts, names):
    """The 6-digit programs inside one 2-digit family, biggest first, as shares of that family."""
    programs = [(names.get(cip, cip), n) for (uid, cip), n in counts.items()
                if uid == unitid and cip.split(".")[0] == family_code]
    if not programs:
        return []
    programs.sort(key=lambda p: (-p[1], p[0]))
    total = sum(n for _, n in programs)
    listed = programs[:TOP_N]
    out = [{"label": label, "pct": round(n * 100 / total, 1), "degrees": n} for label, n in listed]
    tail = programs[TOP_N:]
    if tail:
        # Named rather than dropped: a drawer that silently omits half the family reads as if the
        # family were smaller than it is.
        plural = "programs" if len(tail) > 1 else "program"
        out.append({"label": f"{len(tail)} smaller {plural}", "degrees": sum(n for _, n in tail),
                    "pct": round(sum(n for _, n in tail) * 100 / total, 1)})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--write", action="store_true",
                        help="write the breakdowns into the university files (default: preview)")
    args = parser.parse_args()

    names = cip_names()
    counts = completions()
    labels_to_cip = {label: code for code, label in CIP_FAMILIES.items()}

    for uni in json.load(open(INDEX_PATH)):
        path = uni["dataFile"]
        data = json.load(open(path))
        unitid = str(data.get("unitid", "")).strip()
        if not unitid:
            print(f"\n{uni['id']}: no \"unitid\" in {path} — add the IPEDS UnitID and re-run.")
            continue

        print(f"\n{uni['name']} (UnitID {unitid})")
        filled = 0
        for major in data["majors"]:
            family = labels_to_cip.get(major["label"])
            if not family:
                print(f"  [skip] {major['label']}: no CIP family mapped for this label.")
                continue
            found = concentrations_for(unitid, family, counts, names)
            if not found:
                print(f"  [skip] {major['label']}: no programs reported under CIP {family}.")
                continue
            major["concentrations"] = found
            major["concentrationsSource"] = SOURCE
            filled += 1
            print(f"  {major['label']} ({major['pct']}%)")
            for c in found:
                print(f"      {c['pct']:5.1f}%  {c['label']} ({c['degrees']} degrees)")

        if args.write:
            with open(path, "w") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print(f"  -> wrote {filled} breakdowns into {path}")
        else:
            print(f"  ({filled} breakdowns — nothing written, pass --write to apply)")


if __name__ == "__main__":
    main()
