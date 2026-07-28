# Columbia Map Pin Expansion — Status & Resume Notes

Working notes for the in-progress pin-depth expansion (per Matt's feedback: categories should
be comprehensive, not token single pins — see [[feedback_map_pin_depth]] in Claude's memory).
Read this file first when picking this back up.

## MERGED 2026-07-28 — live map is now 234 pins (was 57)

177 reviewed OSM candidates merged in. Skipped: 8 already-live name collisions (Tom's, Koronet,
Max Soha, Community Food & Juice, Chef Mike's, Riverside Church, Broadway Presbyterian, Butler)
and 3 rejects (St. Mary's Center, Saint Thomas the Apostle (historical), Milstein Center).

Live category counts: group-food 123, wifi 41, church 32, dorm 17, library 15, quiet 15, power 6,
meet 6, dining 5, sit-no-id 4, restroom 3, rain-backup 3, parking 3, subway 1, gym 1.

Merged entries carry `"source": "OpenStreetMap"` so they stay distinguishable from the
hand-researched originals. Entries whose hours OSM didn't have read
`"Hours not listed — check before you go"` — **~55% of merged pins still need real hours**,
which is the biggest remaining data-quality gap.

**Editing these files from a script: splice text, don't `json.dump` the whole file.** A round-trip
silently rewrites existing entries (drops trailing zeros on coords, reflows inline objects like
`schedule`) and buries the real change in hundreds of lines of cosmetic diff. Merge script kept at
`scripts/`-adjacent scratch only; the pattern is what matters.

### Size filter reworked (2026-07-28)

The old rule `!entry.capacity || entry.capacity >= size` **exempted** any pin without a capacity,
so raising the size hid the venues we'd checked and kept every venue we hadn't. Harmless-ish at
15/57 pins with capacity; actively misleading at 15/234 after the merge.

Now (`pinMatchesSize` in `app.js`): the control applies only to `SIZEABLE_CATEGORIES`
(group-food, dining, meet, sit-no-id), and within those an unknown capacity **fails** once size > 1.
Everything else ignores the control. Above size 1 the map shows only spots actually confirmed to
fit that many. Only 8 venues survive size 30, all hand-researched — that's the real state of the
data, not a rendering bug.

**Capacity is the biggest open data gap:** 15 of 234 pins have it, all hand-entered estimates with
no recorded source. OSM does not publish venue capacity, so this can't be scripted.

### Bad-coordinate class of bug

"Claremont Parking Corp." sat at `40.8100, -73.9700` — 2dp, hand-guessed — which reverse-geocodes
to Cherry Walk, i.e. the Hudson River. Traced via its phone number (212-870-6736) to **Rapid Park
at Riverside Church, 621 W 120th St**; renamed and re-geocoded to `40.81117, -73.96317`.
It was the only ≤2dp pin in the file. When hand-adding pins, geocode the address rather than
eyeballing coordinates, and sanity-check that nothing lands west of Riverside Drive.

## Original hand-researched baseline (57 pins)

- **Dorm: 17** — exhaustive against Columbia Housing's official list (Carman, Furnald, John Jay,
  Wallach, Wien, Hartley, Broadway, Hogan, East Campus, 47 Claremont, Schapiro, Ruggles, Watt,
  Harmony, River, Woodbridge, McBain).
- **Library: 15** — exhaustive against Columbia Libraries' official list, **except** the Health
  Sciences Library (excluded on purpose — it's at the Medical Center in Washington Heights, miles
  away, not "near campus").
- **Dining: 5** — John Jay Dining Hall, JJ's Place, Ferris Booth Commons, Faculty House, Chef Mike's
  Sub Shop (all 5 of Columbia's actual dining locations).
- Everything else (group-food, quiet, meet, church, sit-no-id, wifi, power, restroom, rain-backup,
  parking) is at the earlier **manual-research depth** — real, sourced, but not yet comprehensive
  within the 15-minute-walk radius Matt asked for.
- **Subway (1) and Gym (1) are correctly thin, verified, not lazy** — Baker Athletics Complex is a
  confirmed 25-min subway ride away (not walkable), and there's only one practically-relevant subway
  stop. Don't second-guess these without new info.

## The tool: `scripts/find_nearby_pins.py`

Queries OpenStreetMap's free Overpass API for named POIs within a radius of a point, writes to
`data/universities/<university>-map-suggestions.json` — a review queue, **never auto-merged** into
the live map (matches the Slice 8 "AI-suggested, human-reviewed" design in the plan doc — this
tool is effectively an early, map-pins-only implementation of Slice 8, pulled forward because the
need showed up here first).

Built-in first-pass filtering (verified via inline self-check assertions, all passing):
- `--religion christian` restricts `place_of_worship` results server-side, since the bare tag
  matches any faith.
- Chain detection via OSM's `brand` tag — flags `"chain": true` rather than dropping (a reviewer
  might still want a reliable chain option).
- Proximity de-duplication (merges entries within `--dedupe-radius` meters, default 15, keeping
  whichever has more complete data) — OSM sometimes maps the same spot twice.

**Key fix, applies broadly:** Overpass requests need a real `User-Agent` header or public
instances return `406 Not Acceptable`. This was the root cause of every earlier Overpass failure
this session — including the abandoned campus-boundary-polygon attempt (see the plan doc's
Follow-ups/Backlog section). That's now unblocked and worth retrying with this same fix.

**Known dead end:** `amenity=parking` isn't worth querying — OSM parking data is almost entirely
unnamed lot polygons, and the tool discards unnamed results. The 3 manually-researched parking pins
already live are close to what's realistically findable this way.

**Mirror availability (corrected 2026-07-28 — the earlier "rate limiting" note was a
misdiagnosis):** the failures are *server load*, not throttling of us. Confirmed by
`curl https://overpass-api.de/api/status`, which reported `2 slots available now` while queries
were still failing, and by the body of the 504 itself:
`Dispatcher_Client::request_read_and_idx::timeout. The server is probably too busy`.
Check `/api/status` first before assuming you're throttled.

Mirror behavior observed:
- `overpass-api.de` — fastest when healthy, but 504s under load.
- `overpass.kumi.systems` — frequently doesn't respond at all; hangs until the socket times out.
- `maps.mail.ru/osm/tools/overpass` — slower (~25s/query) but stayed up when both others were
  down. Added as a third fallback. Note it's a Russian-operated host; queries send only public
  coordinates and responses are plain OSM data, but flag it if that's not wanted in the chain.
- Tried and rejected: `overpass.private.coffee` (timed out), `overpass.osm.jp` (failed instantly).

Socket timeout raised 40s → 90s to accommodate the slower mirror.

**Large-polygon centroid caveat:** Overpass matches a `way` if *any* part of its geometry is in
radius, but `out center` returns the centroid — so huge parks land a pin far outside the walk
radius. In this run that hit Central Park (centroid 2741m out) and Saint Nicholas Park (1582m).
Only 2 of 207, so it's not worth coding around here, but **watch it for NYU**, which is ringed by
large parks and will likely be hit harder.

## What's actually pending right now

**Re-fetch is DONE (2026-07-28).** All four queries succeeded and
`data/universities/columbia-map-suggestions.json` now holds **207 candidates** after de-duplication:

| category | n | real hours | has URL |
|---|---|---|---|
| group-food (`amenity=restaurant`) | 119 | 57% | 64% |
| wifi (`amenity=cafe`) | 32 | 54% | 45% |
| church (`amenity=place_of_worship`, christian) | 32 | 0% | 40% |
| quiet (`amenity=library`) | 5 | 40% | — |

(188 after the park drop described below, not the original 207.)

`amenity=cafe` — previously suspected of being a dead end like parking — **worked fine** (55 raw,
47 new). It was only ever failing because of the mirror outage. Not a dead end.

The commands that produced this are the four in the block below; re-run as-is to refresh.

```bash
cd "Cross-City-Campus-Hub"
python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag amenity=restaurant --category group-food
python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag amenity=place_of_worship --category church --religion christian
python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag leisure=park --category quiet
python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag amenity=cafe --category wifi
```

### Open review items flagged for Matt (nothing merged yet)

1. **9 already live** — dropping or using them to backfill hours/URLs on the existing entries:
   Tom's Restaurant, Koronet Pizza, Max Soha, Community Food & Juice, Chef Mike's Sub Shop,
   Riverside Church, Broadway Presbyterian Church, Morningside Park, Sakura Park.
2. **2 centroid-out-of-radius** (see caveat above): Central Park, Saint Nicholas Park.
3. **1 defunct church**: "Saint Thomas the Apostle Roman Catholic Church (historical)" — the OSM
   `historical` marker means it no longer operates. "St. Mary's Center" is also a social-services
   org rather than a church.
4. **Church hours are 0%** — every one of the 32 needs manual hours lookup if hours matter here.
5. **"Milstein Center for Teaching and Learning"** is likely a duplicate — Barnard Library (already
   live) is housed inside it. Probably fold into the existing pin rather than adding.

## RESOLVED — Matt's decisions, 2026-07-28

**`quiet` is an indoor-only category.** `leisure=park` was rejected as a proxy: it pulled in 4
playgrounds, traffic islands/medians (Frederick Douglass Circle, Roosevelt Triangle, Samuel Marx
Triangle, A Philip Randolph Square) and an athletic field. All 23 park candidates were **dropped
from the queue**, and `leisure=park` should not be re-run for `quiet` — for Columbia or NYU.

Applied to the live map too, since the rule is definitional rather than batch-specific: `quiet` was
removed from the two outdoor pins that carried it — **Sakura Park** (now `meet`) and **Riverside
Park near W116 St** (now `meet`, `sit-no-id`). Both pins survive under their other categories; live
`quiet` went 14 → 12. Nothing else live is outdoor-tagged `quiet`.

Replacement source for indoor `quiet` depth: **`amenity=library`**, which found 5 — three genuinely
new NYPL branches (Morningside Heights, Harry Belafonte, George Bruce), plus Butler (already live)
and the Milstein duplicate above. Other untried indoor-quiet tags worth a look: `tourism=museum`,
`shop=books`.

**`--religion christian` confirmed intended** for the `church` category. Non-Christian houses of
worship are deliberately out of scope; don't "fix" this later.

### After a successful fetch

1. Do a first-pass sanity read of the suggestions file (chains are flagged, not filtered — decide
   whether to keep any).
2. Get Matt's actual review/approval on which candidates are worth keeping.
3. Merge accepted entries into `data/universities/columbia-map.json` by hand (strip the
   `aiSuggested`/`reviewed` metadata once accepted).
4. Once Columbia's depth feels sufficient, the exact same script + workflow applies to NYU
   (Slice 7 in the plan) — just needs NYU's center lat/lng instead.
