# NYC Campus Hub — Confirmed Intent

**Status:** Confirmed source of truth as of 2026-07-26. Any implementation decision that conflicts
with this doc should either update this doc (with explicit user sign-off) or be rejected — don't
let scope drift silently during implementation.

## Outcome

A free, unlisted-link web app giving up-to-date NYC-wide info plus per-university info for campuses
a college ministry visits regularly (Columbia and NYU first, structured so new universities are easy
to add later). Covers:

- **City-wide:** 7–14 day weather forecast, big city-wide events, traffic conditions/concerns for
  travel between Fort Lee, NJ and NYC.
- **Per-university (own page/tab per school):**
  - Academic calendar in calendar view — move-in/move-out, midterms, breaks, university events, etc.
  - Top 10 majors with percentages
  - Useful student demographics
  - Campus traditions
  - A short blurb on general campus/student culture and life
  - An interactive map of campus + surrounding area with filterable, categorized pins (dorms,
    libraries, dining halls, subway stations, parking lots incl. visitor parking, athletic facilities,
    public restrooms, best places to meet a group, indoor rain backup spots, quiet conversation spots,
    good group-food spots for 5–20 people, nearby churches (link only, no ministry affiliation implied),
    legally-sit-without-ID spots, good Wi-Fi locations, power outlets/charging-friendly study space,
    open gyms). Pins include hours (so open/closed is inferable), contact info where available, and
    are filterable by category and group size, at minimum.

## User

Roughly 50 ministry members/leaders today, likely to grow somewhat — design should not hardcode
assumptions tied to the current scale. **Primarily used on laptop**, with phone as a secondary,
responsive fallback (not the design target). No login or access control: anyone with the link can
view. Nothing private or ministry-internal is ever stored here.

## Why Now

No single up-to-date reference exists today for this logistics/planning info. This tool is
deliberately kept separate from the ministry's Google Suite / OneStop / internal schedule for
security reasons — it must never be a bridge to that private data.

## Success Criteria

Planning or during a campus visit, a ministry member can answer, without asking anyone else:
- Where can we meet a group of 15 people?
- Is it going to rain on us?
- Any traffic getting back to Fort Lee?
- What's this campus's culture like, and can I trust these facts (majors/demographics/calendar) enough
  to plan around them?

## Constraints

- **$0 to build and run.** Free-tier static hosting only (e.g. Vercel/Netlify/GitHub Pages).
- **No backend server required for the live app.** Prefer calling free, no-key-required public data
  sources directly:
  - Weather: Open-Meteo or National Weather Service API
  - Traffic: 511NY / 511NJ public data feeds
  - Demographics / majors: College Scorecard API (federal, free, official)
  - Maps: OpenStreetMap + Leaflet — **not** Google Maps. Google Maps JS API was considered and
    explicitly rejected: it requires enabling billing on a Google Cloud project (credit card on file)
    and a client-side API key that must be locked down with referrer restrictions. Likely free in
    practice at this scale, but not free by design, and reintroduces the exact "paid API + exposed key"
    risk this project is meant to avoid.
- Optimize for "simplest that works, easiest to host for free" — explicitly **not** optimizing this
  build for demonstrating backend/API-design skill (that's a separate, unrelated goal for other
  projects).
- Content that has no public data source (traditions, culture blurb, curated map spots, academic
  calendar) is authored by a human, not scraped/live-generated in the deployed app.

## AI-Authoring Reach Feature

A separate **offline authoring tool** (run manually by the maintainer, never embedded in the deployed
public app) may use AI to draft:
- Culture blurbs
- Academic calendar events
- Campus traditions
- Curated map spot suggestions (meeting spots, quiet spots, Wi-Fi, etc.)

All AI-drafted content is tagged **"AI-suggested"** and held in a review queue. Nothing AI-generated
reaches the live site without explicit manual human review/approval. This is a deliberate security
boundary: the public, no-login, 50+-user app must never have a live/in-app AI feature, since that
would require exposing an API key client-side or standing up a paid/abusable backend endpoint.

## Out of Scope (v1)

- Any integration with the ministry's Google Suite, OneStop, or internal schedule
- Login / user accounts / access control
- Admin dashboard or CMS UI — content is edited directly via data files by the maintainer
- Live or in-app AI generation (only the offline authoring tool, above)
- Auto-publishing AI-suggested content without human review
- Native mobile app

## Content Maintenance Model

- **Factual/volatile, auto-updating (no maintainer action needed):** weather, traffic, demographics/majors
- **Curated/judgment-based, human-authored (optionally AI-drafted, always human-reviewed):** traditions,
  culture blurb, academic calendar, map spot suggestions
- Sole maintainer for now: the user. Structured so a non-technical teammate could take over editing
  data files later without needing to touch app code.
