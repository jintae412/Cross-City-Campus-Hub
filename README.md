# NYC Campus Hub

A planning reference for the ministry's NYC and campus trips. It shows the weather, city events and
travel info for New York, plus a page for each university with its culture, student numbers, top
majors, academic calendar, and a searchable campus map.

There's no login and no database. The whole site is a folder of files, and almost everything it
shows is typed into those files by a person. That's the trade: you have to maintain it by hand, but
it costs nothing to run and it can't break in ways you can't see.

---

## Before you start

Most of the instructions here involve **the Terminal** — the app on a Mac where you type commands
instead of clicking. Open it with `Cmd+Space`, type "Terminal", press Enter.

Every command below assumes you're "inside" the project folder first. Do that once per Terminal
window by typing `cd `, then dragging the project folder onto the Terminal window, then Enter:

```bash
cd /path/to/Cross-City-Campus-Hub
```

When you see a block like the one above, you're meant to type or paste it and press Enter. If
something goes wrong, nothing is broken — none of these commands touch the live site. The site only
changes when you commit and push your changes to GitHub.

## Looking at the site on your computer

**Double-clicking `index.html` won't work properly.** Browsers refuse to let a page opened that way
read the other files next to it, so the map and the data come up blank. It's a security rule in the
browser, not a bug in the site.

Instead, run this:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser. Leave the Terminal window open while you're
looking — when you're done, click back into it and press `Ctrl+C` to stop.

## Two rules that prevent most problems

**1. Never guess a location.** Every pin on the map has a latitude and longitude. Someone once typed
one in by hand and the pin landed in the Hudson River. Always look coordinates up (instructions
below) rather than estimating.

**2. Check your file after editing it.** These data files are picky about punctuation — one missing
comma and the page goes blank. After any edit, run this, replacing the filename with the one you
edited:

```bash
python3 -m json.tool data/universities/columbia.json > /dev/null && echo "OK"
```

If it prints `OK`, you're fine. If it prints an error, it tells you which line has the problem.

## What each file does

| File | What it holds |
|---|---|
| `index.html` | The page layout and the menu down the left side |
| `styles.css` | How everything looks — fonts, colours, spacing |
| `app.js` | How the page behaves — loading data, drawing the map, the filters |
| `hours.js` | Reads opening hours and works out if a place is open right now |
| `data/nyc-events.json` | The city-wide events list on the NYC page |
| `data/universities/index.json` | The list of which universities exist |
| `data/universities/<name>.json` | One university's text — culture, majors, calendar |
| `data/universities/<name>-map.json` | One university's map pins |
| `docs/recommended-to-verify.csv` | The checklist of pins to confirm in person |
| `docs/rental-calls.csv` | The call list for group bookings and how many fit |
| `scripts/` | Tools you run by hand. **None of these are part of the live site.** |

---

# Common jobs

## Adding a new university

Three steps, and you don't need to write any code.

**Step 1 — Create the content file.** Make a copy of `data/universities/columbia.json` and rename it
to your school, all lowercase and no spaces, like `fordham.json`. Then edit it. **Every field has to
be filled in** — if one is missing, that university's page shows an error instead of content.

```json
{
  "id": "fordham",
  "name": "Fordham University",
  "unitid": "191515",
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

**`unitid`** is the university's IPEDS UnitID — the federal government's ID for the institution.
Look it up at [nces.ed.gov/collegenavigator](https://nces.ed.gov/collegenavigator/) (it's in the
page's address once you've found the school). It's only used by the majors breakdown tool below;
a school without one still works, it just won't get the click-in breakdowns.

Two useful tricks in the calendar section:

- Writing `"date": null` means **"we know this happens, we don't know when yet."** The entry still
  appears on the page, just without a date.
- Writing `"verified": false` puts a small **"(unconfirmed)"** note beside it on the page. Use it
  whenever you couldn't confirm something on the university's official site. Saying "we're not sure"
  is always better than presenting a guess as fact.

### Two optional sections

`christianOrgs` and `startingAnRso` are the exceptions to "every field has to be filled in" — leave
either one out and the page renders exactly as it did before, minus that card. Both are per-campus
on purpose: the boards, the membership minimums and the application windows are different at every
school, so a shared list would be wrong everywhere.

```json
{
  "christianOrgs": [
    {
      "name": "Columbia Catholic Ministry",
      "blurb": "Two or three sentences on what the group actually does.",
      "email": "catholics@columbia.edu",
      "site": "https://columbia-catholic.org/",
      "instagram": "@columbiacatholics",
      "phone": "+1 212 555 0100",
      "where": "Thomas Merton Institute, 405 W 114th St",
      "verified": true,
      "source": "https://the-page-you-read-this-on"
    }
  ],
  "christianOrgsNote": "How far the list was checked, and where to look for the current one.",
  "startingAnRso": {
    "intro": "Which board handles this, and when the application window opens.",
    "requirements": ["One requirement per line, in the university's own terms."],
    "links": [{ "label": "Official recognition page", "url": "https://..." }],
    "note": "Where these came from and what to re-check before relying on them."
  }
}
```

Every contact field except `name`, `blurb`, `verified` and `source` is optional, and only the ones
you fill in get a row — a group you could only find a website for shows one line, not five empty
ones. `where` is plain text; the rest become links.

**`verified` is the field that matters most here.** `false` puts the same "(unconfirmed)" note
beside the group's name that an unconfirmed calendar date gets. Use it for anything you didn't read
on an official page yourself. A wrong date is an inconvenience; a wrong email address sends
someone's introduction into a void and they never find out it went nowhere. Club officers also turn
over every year, so contacts go stale faster than anything else on this site — when in doubt, list
the campus chaplaincy or spiritual life office, which doesn't.

`christianOrgsNote` is required once `christianOrgs` exists, and `scripts/test-orgs.js` will fail
without it. It's where you say how far you actually got: which entries you confirmed, which you
didn't, and which official directory to check for the current roster.

To check the rendering after editing any of this: `node scripts/test-orgs.js`.

**Step 2 — Add it to the list.** Open `data/universities/index.json` and add a line for your school.
`mapCenter` is the point the map opens on — usually the middle of campus — written as
`[latitude, longitude]`:

```json
{ "id": "fordham", "name": "Fordham University", "dataFile": "data/universities/fordham.json",
  "mapCenter": [40.8618, -73.8857] }
```

If you leave `mapCenter` out entirely, the page works fine and simply has no map. That's handy if
you want to add the text now and the map later.

**Step 3 — Add it to the menu.** Open `index.html`, find the NYU button and the NYU section, and
copy both. Change `nyu` to your school's name everywhere it appears — five places in total:

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

That's everything. The map, the category dropdown and the colour key all build themselves from your
pin file — there's no separate list of categories to keep in sync.

## Adding or editing a map pin

Pins live in `data/universities/<name>-map.json`. Each one looks like this:

```json
{
  "id": "some-cafe",
  "name": "Some Café",
  "handResearched": true,
  "handVerified": false,
  "categories": ["wifi", "power"],
  "lat": 40.80712, "lng": -73.96341,
  "hours": "Mo-Fr 07:00-19:00; Sa,Su 08:00-18:00",
  "contactUrl": "https://example.com",
  "capacity": 20
}
```

**`categories`** — one or more of these. A pin can be in several at once:

`dorm` · `library` · `dining` · `subway` · `parking` · `gym` · `restroom` · `meet` ·
`rain-backup` · `quiet` · `group-food` · `church` · `sit-no-id` · `wifi` · `power`

One thing to know: **`quiet` means indoors only.** A park is never "quiet" no matter how peaceful —
use `meet` or `sit-no-id` for outdoor spots.

**`lat` and `lng`** — the location. To find them: go to
[openstreetmap.org](https://www.openstreetmap.org), search the address, right-click the exact spot,
and choose "Show address". The two numbers that appear are what you want. Five decimal places is
about right. **Don't estimate these.**

**`hours`** — if you write hours in this exact style, the "Open now only" filter can use them:

```
Mo-Fr 07:00-19:00; Sa,Su 08:00-18:00
```

Days are two letters (`Mo Tu We Th Fr Sa Su`), times are on a 24-hour clock, a dash makes a range,
and a semicolon separates groups of days. You can also write plain English like
`"Hours vary by semester — check their website"`. That displays perfectly well; the pin just won't
respond to the "Open now" filter instead of pretending to know.

**`contactUrl`** — optional. Becomes a "More info" link in the popup. It must start with `https://`,
`http://` or `tel:` — anything else is ignored for safety reasons.

**`capacity`** — optional, and only meaningful for food and meeting spots. Only fill it in if you've
actually checked how many people fit. Nothing filters on it at the moment.

**`handResearched`** and **`handVerified`** — these two look similar but mean different things, and
the difference matters. See the next section.

## Breaking the majors down into concentrations

The "Top Majors" bars are broad federal categories — "Social Sciences 26.9%" doesn't tell you
whether that means economics or anthropology. Each bar can carry a click-to-expand drawer showing
the individual programs inside it. At Columbia, Social Sciences turns out to be 46.5% economics and
32.5% political science; NYU's Visual & Performing Arts is a third film production.

Unlike the venue capacities above, this one is a genuine lookup: the breakdown is published in the
federal IPEDS Completions file, just not in the College Scorecard summary the bars come from. So a
script does the whole job.

```bash
python3 scripts/major_concentrations.py            # show what it would write
python3 scripts/major_concentrations.py --write    # write it into the university files
```

It downloads about 10MB from nces.ed.gov each run and needs no key or signup. Every university that
has a `unitid` gets its categories filled in; run it again when a new year's data is published (bump
`YEAR` at the top of the script).

The numbers are bachelor's degrees only, first majors only — so a double major isn't counted twice —
and each percentage is a share **of its own category**, not of the university. The bar above the
drawer already carries the share of the whole, and the two datasets are different vintages, so
adding them together would invent a precision neither one has. The drawer says which it is on
screen, and the source line names the file and the year.

Categories are matched to federal CIP families by the `CIP_FAMILIES` table at the top of the
script. If you add a university whose major labels differ from the ones already in use, add them
there too, otherwise those categories quietly stay plain bars with no drawer.

To check the majors display still works after editing it: `node scripts/test-majors.js`.

## Verifying pins in person

**No pin on this map has been confirmed by a person yet.** All 1,089 of them came from either
OpenStreetMap (a free public map anyone can edit) or from official university lists. Those are real
sources — but neither one proves a café is still open or that a room is where the map says.

So there are two separate labels on every pin:

| Label | What it means | Shown on the site? |
|---|---|---|
| `handResearched` | A person built this pin from an official source rather than the bulk import | No |
| `handVerified` | Someone actually confirmed the place, in person | **Yes** |

The map has a **"Hand-checked spots only"** checkbox. Right now, ticking it hides every pin and
explains why — because none have been checked. That's the honest starting point. As spots get
confirmed they start appearing there, and that filter gradually becomes the "places we can actually
promise" view.

### What counts as checked

This is the standard. It's written at the top of the checklist too.

> **Tick `y` only if** someone went there in person, or called and spoke to the place, **within the
> last six months**, and confirmed all three of these:
>
> 1. It exists.
> 2. It's at the spot the map shows.
> 3. The hours we list are right.
>
> **Tick `n`** if it's closed, has moved, or the pin is in the wrong place.
>
> **Leave it blank** if nobody has checked it yet.
>
> **Looking at a website or Street View doesn't count.** That's where this data came from in the
> first place — so if that counted, the label would mean nothing.

The six-month limit exists because places near both campuses close constantly. A confirmation from
two years ago isn't evidence of anything.

### How to work through the checklist

**Step 1 — Create the checklist** (already done once, so you'd only redo this if pins change):

```bash
python3 scripts/verify_pins.py --export
```

This writes `docs/recommended-to-verify.csv` — the 98 pins worth confirming first, being the ones
trips actually get planned around.

**Step 2 — Open it in Google Sheets and share it.** File → Import → Upload. Split the rows between
people. Each row has a Google Maps link so you can check the location without leaving the sheet.
Freeze the top two rows so the standard stays on screen.

**Step 3 — Fill in the `CHECKED` column** with `y` or `n` as people confirm things. Use `NOTES` for
anything useful ("entrance is on 114th", "closed Sundays now").

**Step 4 — Download the sheet back into the project.** In Google Sheets: File → Download →
Comma-separated values. Save it over `docs/recommended-to-verify.csv`, replacing the old one. This
is the fiddly step — the tool reads the file on your computer, not the live Google Sheet.

**Step 5 — Feed the answers into the map:**

```bash
python3 scripts/verify_pins.py --import-results
```

It tells you how many pins changed and how many are now hand-checked on each campus.

You can repeat steps 3–5 as often as you like — after a campus visit, at the end of a week,
whenever. Only rows marked `y` or `n` are read, so a half-finished sheet is perfectly safe to
import, and a `?` or a note to yourself is left alone.

One safety net: running `--export` again will **refuse** to overwrite a checklist that has answers
in it, so you can't accidentally wipe the team's work.

## Finding places that will host a group

Two questions come up for every trip: **will this restaurant book a group, and how many of us fit?**
Neither can be looked up. OpenStreetMap doesn't publish either one — of the 1,606 food places within
a 15-minute walk of NYU, two have any capacity tag and one of those is wrong, and only 24 are mapped
as building outlines rather than a single dot, so there's no floor area to work from. The only place
those two answers exist is with the manager, on the phone.

So this is a phone pass. The script's job is just to make the calls quick: it gathers the phone
number, email, website and reservation policy for our `group-food` pins and sorts the list so the
places most likely to say yes are at the top — sit-down restaurants before counter-service, ones
that already take reservations before ones that don't.

**Step 1 — Build the call list:**

```bash
python3 scripts/rental_calls.py --export
```

This writes `docs/rental-calls.csv` — the 40 best candidates per campus, all with phone numbers.
Want more or fewer, use `--limit 60`.

Adding `--check-sites` also reads each venue's own website and marks the ones that advertise
private events, quoting the sentence it found so you can see what the mark is based on. Those get
sorted to the top — on the current list, 28 of the 80 venues say on their own site that they host
groups, so that's 28 calls that start from yes. It's slower (it fetches ~80 websites, honouring
each site's robots.txt) and it never fills in a capacity. See below for why.

### Why capacity can't be looked up, only asked

It's a fair question whether photos or reviews could save the phone calls. Both were checked:

- **The venue's own website** answers *whether* they host groups about a third of the time, which
  is what `--check-sites` uses. It almost never gives a number — of 20 sites read, **zero** stated
  a capacity. The only two numbers on any page were a catering tray's "serves 12–14 guests" and a
  booking form's "8+ People" dropdown, both of which a number-scraper would have filed as capacity.
- **Photos** show one corner of one room, are undated, and have no scale. Worse, they answer the
  wrong question: what matters is how many people the place will seat *as one group*, which is a
  policy, not a physical fact. A 120-seat restaurant that caps parties at 12 is perfectly ordinary,
  and no photograph can show that.
- **Reviews** are the one genuine outside signal — "we had a birthday dinner for 25 here" proves a
  group that size fit. But Google and Yelp both forbid scraping them, and the official API returns
  five reviews per place, which will almost never be the five that mention a group.

Restaurants publish an enquiry form instead of a number on purpose, because the real answer depends
on the date, the room and the spend. Hence the phone.

**Step 2 — Open it in Google Sheets**, freeze the top two rows, and split the list between people.
Row 2 has the four questions to ask, in order.

**Step 3 — Fill in three columns as you call:**

- **`RENTAL`** — `y` if they'll host a private or reserved group, `partial` if it's a big table but
  no private space, `n` if it's walk-ins only.
- **`MAX GROUP`** — the largest group they'll actually seat together. **Not** the fire-code
  occupancy of the room: what matters is the number of chairs they'll give us.
- **`NOTES`** — minimum spend, how far ahead to book, anything else worth knowing.

**Leave the row blank if nobody picked up.** A guess typed in here ends up on the live map looking
exactly like a confirmed number.

**Step 4 — Download the sheet back over `docs/rental-calls.csv`** (File → Download →
Comma-separated values), same as the verification checklist.

**Step 5 — Feed the answers into the map:**

```bash
python3 scripts/rental_calls.py --import-results
```

`MAX GROUP` becomes each pin's `capacity`, and `RENTAL` becomes a line in the pin's popup. Blank
rows are skipped, so a half-worked sheet is safe to import and safe to import again later. As with
the verification checklist, `--export` refuses to overwrite a list that already has answers in it.

To check the script still works after editing it: `python3 scripts/test_rental_calls.py`.

## Reviewing AI-drafted content

Some content — the culture blurb, traditions, academic calendar dates — can be drafted with AI help.
It lands in a holding file, `data/universities/<name>-content-suggestions.json`, and waits there for
a person to check it.

**Drafted entries do show on the site while they wait**, each one carrying an `AI · UNCHECKED` badge
(hover it for the source link). That's a deliberate trade: a plausible-looking date nobody has
confirmed is on the page, so the badge is the only thing standing between it and someone planning a
trip around it. Reviewing them (below) is what makes the badge go away — accepted entries move into
the live file and render plainly. If you'd rather an entry not show at all, delete it from the
holding file.

Culture blurbs are the exception: they stay hidden until accepted, because there's one blurb per
campus and a badged draft would have to replace the real one rather than sit next to it.

The drafting instructions live in
[`scripts/authoring-prompt.md`](scripts/authoring-prompt.md). Here's the review half.

**Step 1 — See what's waiting.** This only reports; it changes nothing:

```bash
python3 scripts/review_content.py --university columbia
```

**Step 2 — Check every source.** Each suggestion comes with a `source` link. **Open every one and
confirm it actually says what the entry claims.** This is the real work; everything else is
paperwork. A wrong date with a genuine-looking citation next to it is exactly what this step exists
to catch.

**Step 3 — Mark what you accept.** Open
`data/universities/<name>-content-suggestions.json` and change `"reviewed": false` to
`"reviewed": true` on the entries you're happy with. Leave the rest as they are, or delete them.

If you've checked everything and want to accept it all at once:

```bash
sed -i '' 's/"reviewed": false/"reviewed": true/g' data/universities/columbia-content-suggestions.json
```

**Step 4 — Merge it in:**

```bash
python3 scripts/review_content.py --university columbia --merge
```

The tool protects you in three ways: it won't merge anything still marked `false`, it won't merge an
entry with no source, and if it finds any problem at all it refuses to merge anything until you fix
it. One thing to watch: accepting a culture blurb **replaces** the existing one rather than adding
to it. It shows you the old and new text before it does.

**Map pins work the same way but with a different tool.** `scripts/find_nearby_pins.py` pulls real
nearby places from OpenStreetMap into a holding file, and you merge deliberately from there. Details
in [`docs/intent/map-expansion-status.md`](docs/intent/map-expansion-status.md).

## Refreshing student numbers and majors

> **Currently shelved** — this needs a free API key that hasn't been set up yet. The numbers in the
> files are correct as of when they were entered; they just won't update on their own.

Student numbers and top majors come from the federal College Scorecard. Unlike the weather, that
service requires a key, and a key can't be put in a public website's code without handing it to
every visitor. So the refresh runs on your computer and the result gets saved into the files:

```bash
export DATA_GOV_API_KEY=...        # free, one-time signup: https://api.data.gov/signup
python3 scripts/refresh_scorecard.py --university columbia            # shows what would change
python3 scripts/refresh_scorecard.py --university columbia --write    # actually changes it
```

The first time you run it for a school it prints a list of matching schools and their id numbers.
Add the right one to `data/universities/<name>.json` as `"scorecardId": 190150` and run it again.
Graduate student counts aren't part of College Scorecard, so the tool never touches those.

---

## Checking everything still works

After editing data files:

```bash
python3 -m json.tool data/universities/columbia.json > /dev/null && echo "OK"
```

There are also built-in self-tests for the code itself. You'd only run these if you changed how the
site works, but they're harmless any time:

```bash
node scripts/test-hours.js                        # opening-hours reading
node scripts/test-majors.js                       # the majors bars and breakdowns
node scripts/test-orgs.js                         # student groups and the new-club card
python3 scripts/review_content.py --self-check    # the review-and-merge tool
```

## Background reading

- [`docs/intent/nyc-campus-hub.md`](docs/intent/nyc-campus-hub.md) — what this is and why, including
  what's deliberately left out. The tie-breaker for any "should we add X?" question.
- [`docs/intent/nyc-campus-hub-plan.md`](docs/intent/nyc-campus-hub-plan.md) — how it was built, and
  the known to-do list.
- [`docs/intent/map-expansion-status.md`](docs/intent/map-expansion-status.md) — where the map data
  came from, what's been checked, and the gaps.
