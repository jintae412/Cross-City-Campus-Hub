# NYC Campus Hub

A planning reference for the ministry's NYC and campus outreach trips: city-wide weather, events and
traffic, plus a page per university with culture, demographics, majors, academic calendar, and a
filterable campus map.

Plain HTML, CSS and JavaScript — no build step, no server, no accounts. Everything the site shows
comes from either a free public API (weather) or a JSON file in `data/`.

## Running it locally

Opening `index.html` directly in a browser **won't work** — browsers block pages loaded from a file
path from reading other local files, so the data files never load. Serve the folder instead:

```bash
cd Cross-City-Campus-Hub
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Press `Ctrl+C` in the terminal to stop.

## Where everything lives

| File | What it holds |
|---|---|
| `index.html` | Page structure and the sidebar nav |
| `styles.css` | All styling |
| `app.js` | Everything the page does — fetching data, drawing the map, filters |
| `hours.js` | Reads opening-hours text and works out whether a place is open now |
| `data/nyc-events.json` | The city-wide events list |
| `data/universities/index.json` | The registry — which universities exist and where their maps center |
| `data/universities/<id>.json` | One university's text content |
| `data/universities/<id>-map.json` | One university's map pins |
| `scripts/` | Offline maintainer tools — never part of the live site |

## How to add a new university

Three steps, no code. Copy an existing file rather than starting blank — `columbia.json` is the
best-filled-in example.

**1. Add the content file.** Copy `data/universities/columbia.json` to
`data/universities/<id>.json`, where `<id>` is a short lowercase name with no spaces (`nyu`,
`fordham`). Fill in every field — **the page will show an error if any are missing**:

```json
{
  "id": "fordham",
  "name": "Fordham University",
  "culture": "Two or three sentences on what campus life actually feels like.",
  "demographics": {
    "undergrad": 9000, "graduate": 6000,
    "womenPct": 55.0, "internationalPct": 8.0,
    "source": "Where these numbers came from — always say."
  },
  "majors": [ { "label": "Social Sciences", "pct": 20.0 } ],
  "majorsNote": "A sentence explaining what the major categories mean.",
  "traditions": ["Tradition One", "Tradition Two"],
  "calendar": [
    { "date": "2026-08-28", "label": "Move-In Day", "verified": true },
    { "date": null, "label": "Finals (dates not yet posted)", "verified": false }
  ]
}
```

Two things worth getting right: `"date": null` is how you say "we don't know yet" — the entry still
shows, just without a date. And `"verified": false` puts an "(unconfirmed)" flag next to it on the
page, which is better than quietly presenting a guess as fact.

**2. Register it.** Add a line to `data/universities/index.json`. `mapCenter` is `[latitude,
longitude]` — the point the map opens on, usually the middle of campus:

```json
{ "id": "fordham", "name": "Fordham University", "dataFile": "data/universities/fordham.json",
  "mapCenter": [40.8618, -73.8857] }
```

Leave `mapCenter` out and the page works fine with no map — useful if you're adding the text content
now and the map later.

**3. Add it to the sidebar.** In `index.html`, copy the NYU button and section, changing `nyu` to
your id everywhere it appears — five places, all shown below:

```html
<button type="button" data-role="nav" data-target="fordham" aria-pressed="false">Fordham</button>
```

```html
<section class="page-section" data-section="fordham" hidden>
  <h2 class="page-title">Fordham University</h2>
  <div id="fordham-content" data-university-content="fordham">
    <p class="placeholder">Loading&hellip;</p>
  </div>
  <div class="map-section" data-map="fordham"></div>
</section>
```

That's it. The map, its filters and its legend build themselves from the pin file — there's no list
of categories to keep in sync.

## How to add or edit map pins

Pins live in `data/universities/<id>-map.json`, one entry each:

```json
{
  "id": "some-cafe",
  "name": "Some Café",
  "handResearched": true,
  "categories": ["wifi", "power"],
  "lat": 40.80712, "lng": -73.96341,
  "hours": "Mo-Fr 07:00-19:00; Sa,Su 08:00-18:00",
  "contactUrl": "https://example.com",
  "capacity": 20
}
```

- **`categories`** — one or more of: `dorm`, `library`, `dining`, `subway`, `parking`, `gym`,
  `restroom`, `meet`, `rain-backup`, `quiet`, `group-food`, `church`, `sit-no-id`, `wifi`, `power`.
- **`lat` / `lng`** — **look these up, don't estimate them.** A pin was once typed by hand as
  `40.8100, -73.9700` and landed in the Hudson River. Search the address on
  [openstreetmap.org](https://www.openstreetmap.org), right-click the spot, choose "Show address",
  and copy the numbers. Five decimal places is about right.
- **`hours`** — if you write it in the format above (`Mo-Fr 07:00-19:00; Sa,Su 08:00-18:00`, 24-hour
  clock), the "Open now only" filter can use it. Anything else, including plain English, still
  displays fine — the pin just won't respond to that filter rather than guessing.
- **`handResearched`** — `true` if a person built this pin from an official source, `false` if it
  came in through the bulk OpenStreetMap import. **Nothing on the site shows this**; it only decides
  which pins land on the verification checklist below.
- **`handVerified`** — `true` only once someone has confirmed in person that the place exists and
  is where we say. This is what the "Hand-checked spots only" filter shows. Don't set it by hand
  in this file — it comes from the checklist (see below), so the flag and the record agree.
- **`contactUrl`** — optional, becomes a "More info" link. Must start with `https://`, `http://`
  or `tel:` — anything else is dropped rather than rendered.
- **`capacity`** — optional, only meaningful for food and meeting spots. Leave it out unless you've
  actually checked. Nothing displays it right now beyond the popup; the group-size filter that used
  it is parked until there's enough capacity data for it to be useful.

`quiet` means **indoor** quiet spots only — parks don't count, however peaceful. Use `meet` or
`sit-no-id` for those.

## How to review and merge an AI-suggested entry

Nothing drafted by AI ever goes live automatically. It lands in a review queue file and waits for a
person. The full workflow and the drafting prompt are in
[`scripts/authoring-prompt.md`](scripts/authoring-prompt.md); the short version:

**For text content** (culture blurb, traditions, calendar):

1. Suggestions arrive in `data/universities/<id>-content-suggestions.json`, each marked
   `"aiSuggested": true, "reviewed": false`.
2. See what's queued — this only reports, it changes nothing:
   ```bash
   python3 scripts/review_content.py --university columbia
   ```
3. **Open every `source` link and confirm it actually says what the entry claims.** This is the
   review; everything else is bookkeeping. A wrong date with a real-looking citation is exactly what
   this step exists to catch.
4. Change `"reviewed": false` to `"reviewed": true` on the entries you accept. Leave or delete the rest.
5. Merge them in:
   ```bash
   python3 scripts/review_content.py --university columbia --merge
   ```

The script won't merge anything still marked `false`, won't merge an entry with no source, and won't
merge at all while it's reporting a problem. Note that accepting a culture blurb **replaces** the
existing one — it prints the old and new text before it does.

**For map pins**, `scripts/find_nearby_pins.py` pulls real nearby places from OpenStreetMap into
`data/universities/<id>-map-suggestions.json`. Those are factual records rather than drafted prose,
but they still land in a queue and get merged deliberately, not automatically. See
[`docs/intent/map-expansion-status.md`](docs/intent/map-expansion-status.md).

## Verifying pins in person

**No pin on this map has been confirmed by a person on the ground yet.** All 1,089 came from
OpenStreetMap or from official university lists — real sources, but none of them a guarantee that a
café is still open or that a room is where the map says.

The map has a **"Hand-checked spots only"** filter for exactly this. Right now it hides every pin
and explains why, because zero have been checked. That's the honest starting state — as spots get
confirmed they start appearing there, and the filter becomes the "things we can actually plan
around" view.

Working through it:

```bash
python3 scripts/verify_pins.py --export           # writes docs/recommended-to-verify.csv
# open it in Google Sheets, split the rows, fill CHECKED with y or n, save back as CSV
python3 scripts/verify_pins.py --import-results   # feeds the answers into the map
```

The checklist holds the 98 pins worth confirming first — the hand-researched ones a trip actually
gets planned around. Each row has a Google Maps link to the exact coordinates so you can check the
location without leaving the sheet.

Import as often as you like; only `y` and `n` rows are read, so a half-finished pass is safe and
`?` or a note to yourself is left alone. Exporting refuses to overwrite a checklist that has
entries filled in, so a stray `--export` can't discard the work.

## Refreshing demographics and majors

These come from the federal College Scorecard, but that API needs a key, and a key can't live in a
public website's JavaScript without handing it to every visitor. So the refresh runs on your machine
instead and the result gets committed as data:

```bash
export DATA_GOV_API_KEY=...        # free, one-time: https://api.data.gov/signup
python3 scripts/refresh_scorecard.py --university columbia            # shows what would change
python3 scripts/refresh_scorecard.py --university columbia --write    # applies it
```

The first run for a school prints matching schools and their ids — add the right one to
`data/universities/<id>.json` as `"scorecardId": 190150` and re-run. Graduate enrolment isn't a
Scorecard figure, so the script never touches it.

## Checking your work

After editing any data file, confirm it's still valid JSON — a stray comma is the most common way to
break the page:

```bash
python3 -m json.tool data/universities/columbia.json > /dev/null && echo "OK"
```

There are two self-checks for the code:

```bash
node scripts/test-hours.js                        # opening-hours parsing
python3 scripts/review_content.py --self-check    # review-queue validation and merging
```

## Background

- [`docs/intent/nyc-campus-hub.md`](docs/intent/nyc-campus-hub.md) — what this is and why, including
  what's deliberately out of scope. The tie-breaker for any scope question.
- [`docs/intent/nyc-campus-hub-plan.md`](docs/intent/nyc-campus-hub-plan.md) — how it was built, slice
  by slice.
- [`docs/intent/map-expansion-status.md`](docs/intent/map-expansion-status.md) — the state of the map
  pin data, what's been verified, and the known gaps.
