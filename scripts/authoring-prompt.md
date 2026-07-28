# Offline content-drafting prompt

Run this **manually**, outside the deployed app, in whatever AI tool you already have open (Claude
Code, the Claude web app, whatever). Nothing here runs on the live site and nothing here needs an
API key — the spec's security boundary is that the public, no-login app never has an in-app AI
feature, and the way to keep that true is for the drafting to happen here, by hand, on your machine.

Output goes to `data/universities/<id>-content-suggestions.json`. It does **not** go live until you
mark entries `"reviewed": true` and run:

```bash
python3 scripts/review_content.py --university columbia --merge
```

The merge script refuses to touch anything you haven't marked reviewed. That's the enforcement, not
a convention you have to remember.

---

## The prompt

Paste this, substituting the university and pasting in the current contents of
`data/universities/<id>.json` so nothing already present gets suggested again.

> You are drafting reference content for a college-ministry planning app. The audience is ministry
> members visiting **<UNIVERSITY>** — adults who don't attend the school and need to plan a visit.
>
> Draft three things:
>
> **1. Culture blurb** — 2–3 sentences on what the campus and student life actually feel like. No
> marketing language, no admissions-brochure tone. What would someone notice walking through campus?
> What's the social texture? Concrete beats flattering.
>
> **2. Traditions** — named, real, recurring campus traditions. One short phrase each (the app
> renders them as a comma-separated list). Only traditions you can point to a public source for.
>
> **3. Academic calendar events** — move-in, move-out, semester start/end, midterms, reading days,
> breaks, commencement. These matter most: a ministry team plans trips around them.
>
> **Rules, all of which matter more than completeness:**
>
> - **Every item needs a `source`** — a URL to a public page, or a specific citation. No source, no
>   item. Don't pad the list to hit a count.
> - **Never invent a date.** If you can't confirm a date from the university's published academic
>   calendar, set `"date": null` and say so in the label — e.g. `"Move-In (exact date not yet
>   confirmed — check <university> Housing)"`. Set `"verified": false` on anything you couldn't
>   confirm against an official source; the app renders those with an "(unconfirmed)" flag.
> - **Academic calendars change yearly.** Say which academic year you drafted from, in the source
>   field. A 2024–25 date presented as current is worse than no date.
> - Don't suggest anything already in the JSON I pasted.
> - Prefer official university pages (registrar, housing, student life) over student press or
>   aggregator sites. Where you used a secondary source, say so — the reviewer decides.
>
> Output valid JSON in exactly this shape, nothing else:
>
> ```json
> {
>   "university": "<id>",
>   "culture": [
>     { "text": "...", "source": "https://...", "aiSuggested": true, "reviewed": false }
>   ],
>   "traditions": [
>     { "text": "Orgo Night", "source": "https://...", "aiSuggested": true, "reviewed": false }
>   ],
>   "calendar": [
>     { "date": "2026-08-28", "label": "Move-In Day", "verified": true,
>       "source": "https://...", "aiSuggested": true, "reviewed": false }
>   ]
> }
> ```

---

## Reviewing

1. Run `python3 scripts/review_content.py --university <id>` to see what's queued and what fails
   validation. It changes nothing without `--merge`.
2. Open every `source` URL. This is the actual review step — an AI-drafted date with a real-looking
   citation that says something else is the exact failure this queue exists to catch.
3. Set `"reviewed": true` on the entries you accept. Delete or leave `false` the rest.
4. Run with `--merge`. Accepted entries land in `data/universities/<id>.json` with the
   `aiSuggested`/`reviewed`/`source` metadata stripped from calendar and tradition entries, since the
   live schema doesn't carry it.

`culture` is a single string in the live schema, so merging a culture suggestion **replaces** the
existing blurb. The script will tell you what it's about to overwrite.

## Map pins

Map spot suggestions are the one content type with a real automated source, so they have their own
tool rather than a prompt: `scripts/find_nearby_pins.py`, which pulls real venues from
OpenStreetMap into `data/universities/<id>-map-suggestions.json`. Same review discipline, different
input. See `docs/intent/map-expansion-status.md`.
