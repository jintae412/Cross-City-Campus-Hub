# Columbia Map Pin Expansion — Status & Resume Notes

Working notes for the in-progress pin-depth expansion (per Matt's feedback: categories should
be comprehensive, not token single pins — see [[feedback_map_pin_depth]] in Claude's memory).
Read this file first when picking this back up.

## Already LIVE (in `data/universities/columbia-map.json`, 57 pins)

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

**Rate limiting:** the two free public Overpass mirrors (`overpass-api.de`,
`overpass.kumi.systems`) throttle under sustained use — after ~7 queries in one sitting, later
queries started failing consistently even on retry, unrelated to query complexity. Space queries
out; don't loop-retry through it.

## What's actually pending right now

A prior run (before the religion/chain/dedup improvements existed) found **209 raw candidates**
(146 restaurants, 39 churches, 24 parks) in the suggestions file. That file was **deleted** before
confirming the regenerated version would fetch successfully — a sequencing mistake — and
regeneration is currently blocked by rate limiting. That data needs to be **re-fetched from
scratch**, not recovered.

### Exact commands to resume with (once rate limits have cooled off)

```bash
cd "Cross-City-Campus-Hub"

python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag amenity=restaurant --category group-food

# NOTE: now with --religion christian, which the original 39-result batch didn't have —
# expect a different (filtered, more correct) result set, not the same 39.
python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag amenity=place_of_worship --category church --religion christian

python3 scripts/find_nearby_pins.py --university columbia --lat 40.807 --lng -73.962 \
  --radius 1200 --tag leisure=park --category quiet
```

Space these out (don't fire back-to-back) given the rate-limiting behavior above.

**Still unresolved from before the rate-limit wall:** `amenity=cafe` (meant to cover more
wifi/power/quiet options) failed on every attempt, even at reduced radius — worth retrying fresh
rather than assuming it's a dead end like parking; it never got a clean success to compare against.

### After a successful fetch

1. Do a first-pass sanity read of the suggestions file (chains are flagged, not filtered — decide
   whether to keep any).
2. Get Matt's actual review/approval on which candidates are worth keeping.
3. Merge accepted entries into `data/universities/columbia-map.json` by hand (strip the
   `aiSuggested`/`reviewed` metadata once accepted).
4. Once Columbia's depth feels sufficient, the exact same script + workflow applies to NYU
   (Slice 7 in the plan) — just needs NYU's center lat/lng instead.
