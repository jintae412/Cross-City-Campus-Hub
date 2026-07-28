# NYC Campus Hub — Implementation Plan

Companion to [nyc-campus-hub.md](./nyc-campus-hub.md) (the source of truth for *what* and *why*).
This doc is the step-by-step *how*, broken into vertical slices — each slice ships something real and
deployable, rather than building horizontal layers (all data models, then all UI, then all deploy) with
nothing usable until the end.

Re-check against the spec doc before starting each slice. If a slice implies a decision the spec
doesn't cover, resolve it against the spec's stated constraints first; if genuinely new, flag it and
update the spec doc rather than quietly deciding.

## Recommended Stack (proposal, confirm before Slice 0)

Simplest option that satisfies "$0, free hosting, no backend":

- **No framework, no build step.** Plain HTML/CSS/JS, loaded directly. A ~50–500 person read-mostly
  app with a handful of pages doesn't need React/Vue/Svelte or a bundler — that's complexity with no
  payoff here. Multiple pages/tabs = multiple simple HTML files or one JS file that swaps view state.
- **Leaflet.js via CDN** for the interactive map (free, no API key, works directly with OpenStreetMap
  tiles).
- **Plain JSON data files** in the repo for per-university content (calendar, majors, demographics,
  traditions, culture blurb, map pins). Adding a university = adding one JSON file + registering it in
  an index, not writing new code.
- **Static hosting:** GitHub Pages, Netlify, or Vercel free tier — any works for pure static files;
  GitHub Pages is the simplest if the repo is already on GitHub.
- **fetch() calls straight from the browser** to Open-Meteo, 511NY/511NJ, and College Scorecard —
  no server round-trip needed since these are public, no-key, CORS-friendly-or-close-enough APIs.
  (Verify CORS support per API during Slice 1/2 — if one blocks browser calls, the fallback is a tiny
  serverless function, not a full backend.)

This is a recommendation, not locked in — flag if you'd rather use something else before Slice 0.

## Confirmed Design Direction

**"Field Guide"** — chosen from three drafts. Book-cloth navy sidebar, parchment content area, oxblood
and gold accents, serif type. Layout is **laptop-primary**: a persistent left sidebar (NYC / Columbia /
NYU) with a wide content area, not a phone-frame layout — phone gets a collapsed top-bar fallback via a
single breakpoint, but isn't the design target. See the published design artifact for the reference build.

Map uses OpenStreetMap + Leaflet (not Google Maps — see spec's Constraints section for why), giving a
real interactive map with actual streets/road names/geography. The artifact's map preview is a hand-styled
approximation (Artifacts can't load external map tiles at all), not a preview of live tile rendering — the
real Slice 5/6 build will look and behave differently (and better) than that mockup once real tiles load.

## Slices

### Slice 0 — Skeleton & Deploy Pipeline
Get an empty "hello world" page live on a free host, end to end, before writing any real feature.
Proves the deploy path works before anything depends on it.
- Bare HTML page with sidebar nav placeholder for "NYC" / "Columbia" / "NYU"
- Deployed to chosen free host, confirm the public link works on a laptop browser (primary target);
  spot-check on a phone too since it must remain usable there

### Slice 1 — NYC Weather
First real vertical slice: one live data feature, fully working, deployed.
- Fetch 7-day forecast (expandable to 14) from Open-Meteo for NYC
- Simple display (list or basic cards) — no styling polish yet
- Deployed and checked on a laptop browser

### Slice 2 — NYC Events & Traffic
Completes the city-wide page.
- City-wide events section (source TBD at this slice — likely starts as a manually maintained list,
  since no single free "big NYC events" API is guaranteed; revisit if a good free source is found)
- Fort Lee ↔ NYC traffic section using 511NY/511NJ feeds
- City-wide page now feature-complete per spec

### Slice 3 — University Data Model + Columbia (text content only)
Establish the "add a university" pattern with one real school, text/data content only (no map yet).
- JSON schema for a university: calendar events, top 10 majors + %, demographics, traditions,
  culture blurb
- Columbia page rendering all of the above from its JSON file
- Majors/demographics pulled from College Scorecard API where available; gaps filled manually
- Academic calendar, traditions, culture blurb: manually authored placeholder content (real AI-assisted
  drafting comes in Slice 8)

### Slice 4 — NYU (prove extensibility)
Add the second university using only the pattern from Slice 3 — no new code, just a new JSON file
and a registration entry. If this requires code changes beyond that, Slice 3's abstraction was wrong;
fix it here before building more on top of it.

### Slice 5 — Campus Map, Basic (Columbia)
- Leaflet map centered on Columbia + surrounding area
- One or two pin categories to start (e.g. dorms, libraries) to prove the map + pin-data pattern
- Pins show name, hours, contact info if available

### Slice 6 — Campus Map, Full Filtering (Columbia)
- All remaining pin categories from the spec (dining halls, subway, parking incl. visitor, athletic
  facilities, restrooms, meeting spots, indoor rain backups, quiet spots, group-food spots, churches,
  sit-without-ID spots, Wi-Fi spots, power outlets/study space, open gyms)
- Filter UI: by category, by group size, plus open-now/closed-now derived from hours
- Confirm filtering works well on laptop width (primary use context); check it degrades sanely on phone

### Slice 7 — Campus Map for NYU
Apply Slice 5+6's pattern to NYU. Same extensibility check as Slice 4 — should be data-only.

### Slice 8 — Offline AI-Authoring Tool — BUILT 2026-07-28
Separate from the deployed app entirely (per spec's security boundary).
- A script/prompt workflow the maintainer runs manually to draft: culture blurbs, calendar events,
  traditions, map spot suggestions — from public sources
- Output goes into a review queue file/format, clearly tagged "AI-suggested"
- Manual review step required before anything moves into the live JSON data
- Not wired into the deployed site in any way

**What was actually built, and why it's a prompt rather than a program:** drafting prose can't be
automated at $0 — calling an LLM API needs a key and a bill, which is the exact thing the spec's
security boundary exists to avoid. So the tool is split:
- `scripts/authoring-prompt.md` — the drafting prompt, run by hand in whatever AI tool the
  maintainer already has. Its rules are the substance: every item needs a `source`, never invent a
  date (use `"date": null` + `"verified": false`), name the academic year, prefer official pages.
- `scripts/review_content.py` — validates the queue and merges only entries marked
  `"reviewed": true`. Rejects any accepted entry with no source, and any malformed or impossible
  date (`2026-02-30`). Reports by default; writes only with `--merge`; refuses to merge at all
  while anything is rejected. This is where the "human review before live" boundary is *enforced*
  rather than just documented. Self-check: `python3 scripts/review_content.py --self-check`.
- `scripts/find_nearby_pins.py` (built earlier) already covers the map-spot half.

Merges splice into the live file rather than round-tripping it through `json.dump`, so the diff
shows only the added entries and hand-written formatting survives.

### Slice 9 — Polish & Handoff
- Responsiveness pass across all pages (laptop is primary; confirm the phone fallback breakpoint holds up)
- Basic error/empty states for the live data fetches (e.g. API temporarily down)
- Short README section: "how to add a new university" and "how to review/merge an AI-suggested entry"
  — written so a non-technical teammate could eventually follow it

## Follow-ups / Backlog

- **Campus boundary outline (Columbia, and later NYU).** Attempted in Slice 5 using hand-derived
  corner coordinates (from one confirmed street-corner lookup + known building coordinates); the
  result was noticeably too small/inaccurate once rendered on the real map and was removed.
  **Update:** the Overpass timeouts encountered then were actually a missing `User-Agent` header
  (fixed in `scripts/find_nearby_pins.py` during the Slice 6 pin-expansion work) — this is now
  unblocked and worth retrying with a real queried boundary rather than derived corners.
- **Columbia map pin depth (in progress).** Mid-expansion using `scripts/find_nearby_pins.py` (an
  early, map-pins-only implementation of the Slice 8 offline-authoring tool, pulled forward because
  the need showed up here first). See
  [map-expansion-status.md](./map-expansion-status.md) for exact state and resume steps — do not
  re-derive this from scratch, read that file first.

## Working Agreement

- Build and check off one slice at a time; don't start the next until the current one is actually
  deployed and viewable, not just "done locally."
- Treat [nyc-campus-hub.md](./nyc-campus-hub.md) as the tie-breaker for any scope question. If a slice
  tempts scope creep (auth, a framework, a backend, live AI), that's a signal to stop and check it
  against the spec's constraints/out-of-scope list before proceeding.
