# PTO Planner — Build Plan

_Written 2026-08-08 for the build session. The scope was fully resolved in a
grill session the same day — see the 2026-08-08 entry in `ROADMAP.md`. This
file is the implementation plan: follow it as written; the decisions in it are
John's and are not open for re-scoping. If something here genuinely cannot be
built as specified, stop and ask John rather than silently substituting._

**Read first:** `CLAUDE.md` (especially §6 migrations, §7 rules), the
2026-08-08 `ROADMAP.md` entry. Follow the Agentic Loop protocol (§9 — this
change touches 3+ files and adds a data domain). **No AI anywhere in this
feature** — pure date math + CRUD.

---

## 1. What's being built (one paragraph)

A PTO section on `/travel` answering "how many days do I have left?": a
self-set **25-day annual budget** (editable — it is John's target, CrossCountry
PTO is unlimited, so there is no employer balance and no accrual math),
resetting each **calendar year**. Days are logged mostly **automatically from
trips** (weekdays minus firm holidays), with per-trip overrides, plus rare
manual entries. A second, separate ledger tracks **banked holidays** (worked a
firm holiday → +1, spend it later → −1; never mixed into the PTO number). On
top of the real ledger sits a **simulation layer** (wishlist what-ifs, a
sandbox calculator, saved named scenarios) and a **year switcher** covering
the current year plus two ahead — simulations never touch the real numbers.
Home's existing Travel card gains one "N PTO left" line (current year). Not a
7th domain — no new route, no new Home card.

## 2. Migration `016_pto.sql` (+ update `neon/schema.sql`)

Idempotent DDL, per §6. Do **not** run it against Neon during the build —
`npm run migrate` happens after merge (see §8).

```sql
-- Singleton settings row (same pattern as french_hours_summary's singleton).
CREATE TABLE IF NOT EXISTS pto_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_budget integer NOT NULL DEFAULT 25,  -- John's target, not an employer number
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pto_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Firm holidays, editable in-app. `worked` feeds the banked counter.
CREATE TABLE IF NOT EXISTS pto_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name         text NOT NULL,
  worked       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Manual whole-day entries. kind='pto' = a non-trip PTO day;
-- kind='banked_spend' = spending one banked holiday on that date.
CREATE TABLE IF NOT EXISTS pto_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('pto', 'banked_spend')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_date, kind)
);

-- Saved simulation scenarios. Items are references + ranges only; costs are
-- always computed live against the chosen year's holidays, never stored.
CREATE TABLE IF NOT EXISTS pto_scenarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  items      jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- item shapes: {kind:'wishlist_trip', trip_id} — a dated wishlist trip —
--          or  {kind:'range', label, start_date, end_date} — an ad-hoc range.

-- Per-trip corrections. An override sticks — auto math never overwrites it
-- (same discipline as image_source = 'manual').
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pto_days_override integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pto_exempt boolean NOT NULL DEFAULT false;
```

Seed CrossCountry's 2026 firm holidays in the same migration
(`INSERT ... ON CONFLICT (holiday_date) DO NOTHING`):

| Date       | Name                                                        |
| ---------- | ----------------------------------------------------------- |
| 2026-01-01 | New Year's Day                                              |
| 2026-01-19 | MLK Day                                                     |
| 2026-05-25 | Memorial Day                                                |
| 2026-06-19 | Juneteenth                                                  |
| 2026-07-03 | Independence Day (observed — Jul 4 is a Saturday in 2026)\* |
| 2026-09-07 | Labor Day                                                   |
| 2026-11-26 | Thanksgiving Day                                            |
| 2026-11-27 | Day after Thanksgiving                                      |
| 2026-12-25 | Christmas Day                                               |

\* Confirmed by John (2026-08-08): the firm's observance convention is
**Saturday holiday → the prior Friday, Sunday holiday → the following
Monday**. Holidays are always stored as their **observed weekday date** (that's
the workday that becomes non-PTO), so the app never needs observance math —
but the holidays editor should warn (not block) when a weekend date is
entered, since that's almost certainly an unobserved date typed by mistake.

Then update `neon/schema.sql` (tables + trips columns + "Applied migrations:"
line → `016_pto`).

## 3. `lib/pto.js` — pure math, unit-checkable

All functions pure (take rows + a `today` date + a target `year` in; no DB
access, no server-only imports), so the math can be unit-checked without Neon
**and imported by client components** — the sandbox calculator and scenario
costs reuse these exact functions in the browser (fed holidays from the GET
payload) instead of duplicating the math. Dates are date-only strings — reuse
the existing date-only handling conventions (see the 2026-07-15 UTC off-by-one
fix in `ROADMAP.md`; don't reintroduce that bug class).

- **PTO year**: every computation is windowed to Jan 1–Dec 31 of a target
  `year` parameter. The default view is the calendar year of `today` (server
  clock); the panel's year switcher can select the current year **plus the
  next two** (2026–2028 while in 2026 — John plans up to two years out).
  Budget is the same single editable number for every year (a fresh 25 each
  Jan 1, not a per-year setting). A future year with no holidays entered yet
  computes without holiday exclusions and the UI says so honestly ("no 2027
  holidays entered yet") rather than pretending the count is final.
- **Trip auto days**: for each trip with status `upcoming`/`past` (wishlist
  never counts) and non-null start/end dates overlapping the year: count
  **weekdays (Mon–Fri)** in `[max(start, Jan 1), min(end, Dec 31)]`, excluding
  dates present in `pto_holidays`. Split per-day: dates ≤ today → **taken**,
  dates > today → **planned**.
- **Overrides**: `pto_exempt = true` → trip contributes 0. Else
  `pto_days_override` non-null → that number wins over the auto count,
  classified whole (trip `end_date` < today → all taken, else all planned — an
  accepted simplification; per-day split only exists for auto counts). The
  auto number is still computed and returned alongside, so the UI can show
  "auto would be N" next to an override.
- **Manual PTO entries** (`kind='pto'`) in the year: one day each, taken vs
  planned by date. Banked spends do **not** touch any PTO number.
- **Summary**: `taken`, `planned`, `left = annual_budget − taken − planned`
  (may go negative — show it honestly, never clamp).
- **Banked ledger** (fully separate): `earned` = holidays in the year with
  `worked = true`; `spent` = `banked_spend` entries in the year;
  `available = earned − spent`. The API refuses a spend that would make it
  negative. **No automatic interaction with trip math** — if a spent banked
  day overlaps a trip, John adjusts that trip's override himself (his explicit
  call, revised from an earlier auto-offset idea).
- **Simulation math** (same pure module): a scenario item's cost = the
  weekday-minus-holiday count of its range within the target year (a dated
  wishlist trip uses its own dates; an undated wishlist trip is not simulable
  and is reported as such, never guessed). Simulated results are always
  derived as `left − scenarioCost` and labeled "would leave X" — **no
  simulation value is ever added into `taken`/`planned`/`left`**.

## 4. API routes

All are **user-input CRUD shape** — `route()`-wrapped from `lib/route.js`
(JSON `{error}` on throw; explicit 400s for validation). Nothing here is an
external-source/fail-soft route, and nothing calls Anthropic.

- `app/api/pto/route.js` — `GET` (accepts `?year=`, validated to the current
  year through current+2; defaults to current): one round trip returning
  `{ year, budget, taken, planned, left, banked: {earned, spent, available}, holidays: [...], entries: [...], trips: [{id, destination, start_date, end_date, autoDays, override, exempt, counted}], wishlist: [{id, destination, start_date, end_date, simDays}], scenarios: [...] }`
  (query trips + holidays + entries + scenarios + settings, compute via
  `lib/pto.js`). `PATCH`: update `annual_budget` (validate: integer ≥ 0).
- `app/api/pto/scenarios/route.js` — `POST` create (name + items, validated
  against the item shapes); `app/api/pto/scenarios/[id]/route.js` — `PATCH`
  (name/items), `DELETE`. Costs are never persisted — reads compute them.
- `app/api/pto/holidays/route.js` — `POST` add (date + name);
  `app/api/pto/holidays/[id]/route.js` — `PATCH` (name/date/`worked` toggle),
  `DELETE`.
- `app/api/pto/entries/route.js` — `POST` (date, kind, optional note; reject a
  `banked_spend` beyond `available`); `app/api/pto/entries/[id]/route.js` —
  `DELETE`.
- `app/api/trips/[id]/route.js` — extend the existing PATCH allow-list with
  `pto_days_override` (integer ≥ 0 or null to clear) and `pto_exempt`
  (boolean). No new route.
- `app/api/home-summary/route.js` — add a `pto: { left }` field, computed from
  the same `lib/pto.js` math (all DB-local queries — cheap, consistent with
  Home's no-external-calls rule).

`budget` and `pto_days_override` are integers, but remember the Neon driver
gotcha: `numeric` columns come back as strings — these are `integer` so they're
fine, but coerce defensively with `num()` where the codebase already does.

## 5. UI

**`/travel` — a PTO panel** (new `components/PtoPanel.jsx` + module CSS,
rendered on `app/travel/page.jsx` near the Stats bar; match the page's
existing dark visual language — this is a real design surface, not a plain
table dump):

- Header: a **year switcher** (current year → current+2; default current).
  Headline: **"X left · Y taken · Z planned"** plus the separate
  **"N holidays banked"** counter. Budget is editable inline (the 25).
- A per-trip list (from the GET payload): each counted trip with its day
  count, an inline override input and a "no PTO" (exempt) toggle — optimistic
  updates PATCHing `/api/trips/[id]`, reverting on failed persist, per the
  app's convention.
- Manual entries: add a PTO day or a banked-spend day (date + note), list +
  delete.
- Holidays editor (popup, mirroring the existing Hidden/Renamed popup
  pattern): rows of date · name · **worked** toggle, add and delete — this is
  how John enters each new year's calendar himself.
- **Planning (simulation) sub-section** — visually distinct from the real
  ledger (every figure phrased "would leave X", never blended into the
  headline): (1) **wishlist what-ifs** — each dated wishlist trip in the
  selected year as a row: "would cost N days → would leave X" (undated:
  "add dates to simulate"); (2) **sandbox calculator** — two date inputs →
  live cost + resulting balance, client-side via the shared `lib/pto.js`
  math, nothing saved; (3) **saved scenarios** — create/rename/delete a named
  scenario, add/remove items (pick a dated wishlist trip or enter a range),
  showing per-item costs, the total, and the would-be balance for the
  selected year.
- Fed by `useResource('/api/pto')` so the TopBar refresh covers it; mutations
  call the hook's `reload()` after persisting (the established pattern).

**Home** — `components/DomainGrid.jsx`: the existing Travel card gains one
line, e.g. "12 PTO left", from the new `home-summary` field. No new card.

## 6. What NOT to do

- No new top-level route/domain, no Sidebar entry, no new Home card.
- No AI, no external API calls — this feature is Neon-only.
- No accrual math, ever — the budget is John's editable number.
- Never auto-overwrite `pto_days_override`/`pto_exempt` from trip edits.
- Banked spends never automatically change a trip's PTO count.
- Don't merge the two ledgers into one displayed number.
- Never blend a simulated cost into `taken`/`planned`/`left` — simulation is
  read-only arithmetic on top, always labeled "would …".
- Wishlist trips stay excluded from the real balance even when simulated.
- Don't invent dates for an undated wishlist trip, and don't guess a future
  year's holidays — an empty holiday year is stated, not filled in.
- Don't duplicate the date math client-side — import the same pure
  `lib/pto.js` functions.
- Don't cache `/api/pto` in the service worker (API routes are never cached).

## 7. Verification (before pushing)

- `next build` clean; Prettier passes on all touched files.
- Unit-check `lib/pto.js`: weekday counting across a known range; holiday
  exclusion; year clamping for a trip spanning Dec→Jan; taken/planned split
  around `today`; override + exempt precedence; banked earned/spent/floor;
  budget-minus-usage including the negative case; scenario cost for a future
  year with and without holidays entered; the undated-wishlist "not simulable"
  path; the `?year=` bounds (current → current+2 accepted, others rejected).
- Render `/travel` and `/` headlessly (Chromium) against a mocked `/api/pto` /
  `/api/home-summary` — both themes; confirm a fetch failure shows a real
  error state, not fake-empty data (same class of bug caught on `/language`).

## 8. After merge (John or a Claude session — not the build)

- Run `npm run migrate` (or apply via the Neon MCP) **before relying on the
  deployed code** — Preview + Production share one Neon DB (§6; this was a
  real outage on PR #29).
- Add the dated build entry to `ROADMAP.md` and check off the scoped item;
  update `CLAUDE.md` §5/§6/§7 and `ARCHITECTURE.md`'s domain table to mention
  the PTO slice; delete this plan file once built (its content lives on in the
  ROADMAP entry).
