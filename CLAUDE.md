# Personal Dashboard

Master personal planning hub consolidating John's AI projects, travel, schedules, language learning, idea backlog, and email triage into one home. Built for a single user (John), no public access.

> **Session start:** read `ARCHITECTURE.md` (system map) and the latest `ROADMAP.md` entry (recent decisions) before making structural changes.

- **Repo:** `jonncy18-maker/Personal-Dashboard`
- **Live URL(s):** _(fill in after first Vercel deploy)_
- **Stack:** Next.js (App Router) + JavaScript + Vercel + Neon
- **Cutover:** N/A — greenfield project, scoped July 2026

## 1. Stack

| Layer      | Choice                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| Framework  | Next.js (App Router)                                                                     |
| Frontend   | React                                                                                    |
| Routing    | Next.js App Router (file-based) — one route per domain under `app/`                      |
| Language   | **JavaScript (`.jsx`/`.js`)** — matches the NextGen-Immersion gold standard              |
| Styling    | _(Claude Code's judgment — follow `frontend-design` skill, avoid generic template look)_ |
| Database   | Neon (new, separate project — not shared with AI-Capital-Planning)                       |
| Auth       | **None — deliberately dropped.** See §7.                                                 |
| Hosting    | Vercel (native Git integration — no CI workflow)                                         |
| Formatting | Prettier — config copied verbatim from the gold standard (single quotes, semis, 80-col)  |
| AI         | Claude Haiku (`claude-haiku-4-5`) — used narrowly; see §7                                |

**Two deliberate divergences from the NextGen-Immersion gold standard, documented so a future session doesn't "fix" them back:**

1. **App Router, not a HashRouter SPA.** The gold standard is a Vite SPA migrated into a Next shell (`app/page.jsx → dynamic(App,{ssr:false})` + `pages/api/*`). This is greenfield with no SPA legacy, so it uses real App Router file-based routes and `app/api/*` route handlers. The blueprint's SPA-shell `next.config.js` rewrite is intentionally absent.
2. **No auth.** The blueprint calls same-origin Neon Auth "the single highest-value pattern to copy." It does not apply here: this is a single-user private app. Auth (and `better-auth`/`jose`/`@neondatabase/auth`) is deliberately omitted. Do not add it back — gate access at the Vercel project level if needed.

No migration history — this is a new project, built directly to this stack from day one.

## 2. API Key / Security Rules

| Key                                                    | Prefix             | Lives                                           | Why                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Neon connection string (`DATABASE_URL`)                | none (server-only) | Vercel env (Production + Preview)               | DB access — never exposed to browser                                                                                                                                                                         |
| Vercel API token                                       | none (server-only) | Vercel env (Production + Preview)               | Read-only calls to Vercel's own API (`list_projects`, `get_project`, `list_deployments`) for AI Projects' live deploy status                                                                                 |
| GitHub API access (`GITHUB_TOKEN`)                     | none (server-only) | Vercel env (Production + Preview), **optional** | Public repo reads work with no token. Set `GITHUB_TOKEN` to raise the rate limit (60→5000 req/hr) and reach private repos. Used by `lib/github.js` for AI Projects (repo meta, commits, milestones, Next Up) |
| Google OAuth (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`) | none (server-only) | Vercel env (Production + Preview)               | One client, read-only scopes for **Calendar** (next Spanish tutor call) and **Gmail** (Email domain + Travel import)                                                                                         |
| Anthropic API key (Claude Haiku)                       | none (server-only) | Vercel env (Production + Preview)               | Narrow uses only: Email Tier 2 semantic residual + Travel itinerary parse. See §7                                                                                                                            |
| Unsplash access key (`UNSPLASH_ACCESS_KEY`)            | none (server-only) | Vercel env (Production + Preview)               | Read-only search API — auto-fetches a trip's destination photo (Travel, auto + manual override). See §7                                                                                                      |

**Rule:** anything that touches the Vercel API, Neon connection, Google APIs, or Anthropic API goes through a server-side route handler (`app/api/*`); the browser never calls any of these directly. No env var carrying a secret gets a `NEXT_PUBLIC_` prefix.

**Rule:** the Gmail integration is **read-only by design**. No code path may call a Gmail write/modify/delete endpoint. "Hiding" an email only sets a local flag in this app's own Neon database (`email_hidden`); the actual Gmail mailbox is never touched.

## 3. Project Structure

_(Expected shape given domain-per-route App Router. Claude Code populates real paths during Build.)_

```
app/
  page.jsx                 # Home — status cards for all 6 domains
  ai-projects/page.jsx     # AI Projects — popup w/ project cards (Vercel + GitHub) + Add Project
  travel/page.jsx          # Travel — trip records + AI-assisted Gmail itinerary import
  schedules/page.jsx       # Schedules — cross-domain task/prep list, optional trip/project link
  language/page.jsx        # Language — "coming soon" + live "next Spanish call" card (Calendar)
  ideas/page.jsx           # Idea Board — title/notes/status/domain-tag CRUD
  email/page.jsx           # Email — read-only Gmail view, Tier 1 + Tier 2 hide rules, onboarding scan
  api/
    vercel/route.js        # Server-side Vercel API proxy
    github/route.js        # Server-side GitHub public API proxy (ROADMAP.md "Next Up")
    calendar/route.js      # Server-side Google Calendar proxy (read-only)
    gmail/route.js         # Server-side Gmail proxy (read-only — list/search only)
    email-rules/route.js   # CRUD for Tier 1 + Tier 2 rules; Haiku for Tier 2 residual only
    travel-import/route.js # AI-assisted Gmail search + parse for itinerary import (Haiku)
    schedules/route.js     # CRUD for cross-domain Schedules tasks
lib/
  db.js                    # Neon client + num() numeric-string coercion helper
  anthropic.js             # Shared Haiku client (server-only)
neon/
  schema.sql               # canonical current DB state
  migrations/              # numbered, immutable, additive (see §6)
```

## 4. Environment Variables

```
# Server-side (no public prefix)
DATABASE_URL=              # Neon connection string
ANTHROPIC_API_KEY=         # Claude Haiku — Email Tier 2 residual + Travel parse
VERCEL_API_TOKEN=          # Read-only Vercel API access for AI Projects
GOOGLE_CLIENT_ID=          # Google OAuth — read-only Calendar + Gmail
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GITHUB_TOKEN=              # OPTIONAL — raises GitHub rate limit + unlocks private repos (AI Projects)

# Client-side (public-prefixed)
NEXT_PUBLIC_APP_URL=       # Same-origin base URL
```

**Gotcha:** per Stack Blueprint Part 2, set every one of these for both **Production and Preview** in Vercel explicitly — a var present only in Production makes Preview deploys fail in a way that looks like a runtime bug, not a config bug.

## 5. Routes / Pages

| Route          | Component         | Role                                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | Home dashboard    | Status cards, one per domain (6), linking into each domain's page                                                                                                                                                                                                                                    |
| `/ai-projects` | AI Projects       | Popup lists all tracked projects. Each: Vercel deploy status + live link (if a Vercel URL is set) OR a "protocol/library" badge + GitHub link (if not). Each card shows a "Next Up" line parsed from that repo's `ROADMAP.md`. "Add Project" = two fields (GitHub URL required, Vercel URL optional) |
| `/travel`      | Travel            | Trip records (destination, dates, status, notes, optional budget). Click into a trip for full day-by-day/port itinerary (AI-assisted Gmail import — §7). No Idea Board link in v1                                                                                                                    |
| `/schedules`   | Schedules         | Cross-domain task/prep list (title, notes, due date, status, optional link to Travel trip / AI project). A linked item's card shows a small indicator when it has open Schedules tasks. Distinct from Idea Board by having a due date                                                                |
| `/language`    | Language Learning | "Coming soon" placeholder, except one live card: next Spanish tutor call from Google Calendar, matched by host/keyword (e.g. "italki") — no AI                                                                                                                                                       |
| `/ideas`       | Idea Board        | CRUD — title, notes, status, domain tag. No promotion path to AI Projects. Distinct from Schedules by having no due date                                                                                                                                                                             |
| `/email`       | Email             | Read-only Gmail triage. No categorization buckets. Tier 1 + Tier 2 hide rules (§7). Management view lists both tiers w/ undo/delete. First-run onboarding scan (§7)                                                                                                                                  |

## 6. Schema & Migrations

Lightweight convention — no ORM (overkill for one user), but a small runner closes the "migration file merged, database never updated" gap:

- **`neon/schema.sql` is the single source of truth** for the current DB shape. Read that one file; never reassemble state from migration history.
- **Every change is a new numbered file** in `neon/migrations/` (`001_initial.sql`, `002_*.sql`, …). Applied migrations are **immutable** — never edit one. A later change (settling Language, adding a new domain) is always a new file.
- **After applying a migration, update `schema.sql`** to reflect the sum of all migrations, and bump its "Applied migrations:" line.
- **All DDL is idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` + recreate). Re-running a migration is always safe.
- **Settled domains have tables now; undecided ones don't.** Language Learning has no table yet (its v1 card reads live from Calendar). Do not add speculative tables — a new domain later is a 2-file operation (new migration + update `schema.sql`), not something to pre-guess.

**`npm run migrate` (`scripts/migrate.js`) applies pending migrations — run it explicitly, never automatically.** It tracks applied files in a `schema_migrations` table and runs any `neon/migrations/*.sql` not yet recorded, in filename order. It is a plain script, not a framework (no Prisma/Drizzle) — splitting each file into individual statements itself, since the Neon serverless driver accepts one statement per call.

**Deliberately NOT wired into the Vercel build.** Surfaced 2026-07-15/16: Preview and Production deployments share **one** Neon database here (no per-branch DB). Auto-running migrations on every build — the normal move for apps with a branched/staging DB — would mean an unmerged, unreviewed PR's schema change lands on the live database the moment its preview builds. Instead: **after merging a PR that adds a migration, run `npm run migrate` (or ask Claude Code to, via the Neon MCP) before relying on the deployed code that needs it.** This was a real outage during the Travel redesign (PR #29): the code shipped expecting new columns that didn't exist yet in Neon, and `/travel` 500'd until the migration was applied by hand.

## 7. Key Rules for Claude Code

**No auth — and don't add it back.** Single-user private app. The blueprint's same-origin Neon Auth pattern does not apply here. If access needs gating, do it at the Vercel project level, not by reintroducing an auth layer.

**The Vercel API token is a real secret with write-capable scope if over-provisioned.** Scope it read-only in Vercel's token UI if possible, and never let it reach client code. A leaked deploy-capable token is a materially worse failure than a leaked read-only one.

**Don't conflate GitHub and Vercel in AI Projects.** Vercel sources deploy status + live URL. GitHub sources the "Next Up" line, parsed from a standardized `## Next Up` section at the top of that repo's `ROADMAP.md`. Two separate API calls, two purposes — don't merge them into one data-model field or one fetch. _(Cross-repo dependency: this `## Next Up` convention does not yet exist in any sibling repo — see §10.)_

**"Add Project" has no auto-detection — deliberately rejected.** Two explicit fields (GitHub URL required, Vercel URL optional). Do not scan Vercel projects to match a pasted GitHub URL.

**AI Projects is mostly GitHub/Vercel-derived, with a thin manual layer — and no fabricated metrics.** The redesigned view (`/api/projects/overview` aggregates it server-side via `lib/github.js` + `lib/vercel.js`) shows real data: repo description, language, **topics** (the tech/category badges), **last commit** + relative time, open issues, deploy status, a **real Recent Activity feed** (commits + deploys merged), and **progress from a repo's open GitHub milestone** (closed ÷ total issues — shown only where a milestone exists; no milestone = no bar, honestly). The only things GitHub can't know live in `projects` as a small manual layer (migration 007): **`status`** (lifecycle — drives the tabs + the top counts) and **`featured`** (at most one; the featured panel), edited in the row's hover popover. Do **not** invent a "progress %", "daily focus", or "↑ N% this week" trend for a project — same rule as everywhere else: a metric comes from real data (GitHub/Vercel/milestone) or a field John maintains, never a hardcoded number.

**Gmail access is read-only, full stop.** No code path may call a Gmail write/archive/delete/modify endpoint. "Hiding" an email only sets a local flag (`email_hidden`) — the real mailbox is never touched. Hard boundary, not a revisitable default.

**Email is AI-minimal — most of it needs no model:**

- _Tier 1 (sender rules):_ triggered by the "X" button. **No AI.** The sender/domain is parsed directly from the email header into a deterministic rule (e.g. hide `dominos.com`). Filtering is then a plain DB lookup.
- _Gmail-native categories do the fuzzy work for free:_ Gmail already computes `category:promotions/social/updates`. Lean on those + search operators (e.g. `from:bank category:promotions`) before reaching for a model.
- _Tier 2 (content rules):_ Haiku is used **only for the semantic residual** Gmail categories can't express (e.g. "hide shipping-delay notices but keep delivery confirmations"). John types a plain-language rule; Haiku evaluates future emails from that sender against it. Small ongoing per-email cost — deliberately scoped to the residual, not applied to Tier 1's senders.
- _Onboarding scan is not AI either:_ on first visit to `/email`, group recent senders by frequency (a `GROUP BY`, no model) and propose likely Tier 1 candidates for one-pass approve/reject. **One-time** — track completion in `app_flags`; never re-run on every load.

**Travel's itinerary import is a distinct AI use — Haiku, and it stays.** Flow: (1) John triggers import on a trip, (2) Haiku searches Gmail (read-only, same boundary as Email) for a likely confirmation/itinerary email, (3) if confident, parse; if not, ask John to identify the right email, (4) show a **preview for John to confirm/edit before saving** — never auto-save parsed data. This genuinely needs extraction, unlike the email tiers — keep it on Haiku.

**Travel's destination photo is auto-fetched, with manual override — not AI-generated.** On trip create/edit, if `trips.image_source = 'auto'`, a server route queries Unsplash's search API with the cleaned destination and caches the result on the row (`image_url`, `image_attribution`). One call per trip change, never per page load. Never generate an image (DALL·E/etc.) for this — real destination photography is cheaper, faster, and not hallucinated. If John pastes/picks a specific photo, set `image_source = 'manual'` so a later auto-refresh never overwrites it. No result or API failure falls back to the domain's plain accent treatment — never a broken layout.

**Travel's map pins are geocoded, cached on the row — not fetched per load.** On trip create/edit, `lib/geocode.js` resolves the cleaned destination to `trips.latitude`/`longitude` via OpenStreetMap Nominatim (no API key; a descriptive `User-Agent` is required by their policy). Same discipline as the photo: one lookup per trip change, cached on the row (`geocoded_at` stamps the attempt so a trip created before this feature backfills exactly once via `/api/trip-map`, never every load). A failed lookup just means no pin — the map skips that trip, never breaks. The world map itself is a static, precomputed SVG path (`components/world-land-path.js`, from public-domain Natural Earth 110m land) projected equirectangularly; **do not** add a paid map-tile provider.

**Travel's AI Brief is a new, deliberately-scoped Haiku use — and it stays honest.** `/api/travel-brief` (via `lib/travel-brief.js`) has Haiku write a 2–4 sentence summary of upcoming trips, grounded **strictly** in real trip fields (countdowns, length, budget-set-or-not, itinerary planned-or-not). Hard rule: it must **never invent** flight availability, prices, weather, seasons, visas, or any fact not in the data — that would be a hallucinated travel claim presented as advice. It is **cached** in `travel_brief` keyed by a `signature` (hash of the summarized trip fields + the calendar day), so a page load never triggers a model call unless something actually changed; countdowns stay fresh by regenerating at most once a day. This expands the AI scope beyond Email + itinerary import on purpose (John's call) — keep it on Haiku and keep it grounded.

**Home's hero photo changes with the time of day — cached, never per-load, and honest.** The Home hero shows a scenic Unsplash photo matching the viewer's local time band (Dawn 5–8 / Day 8–17 / Golden 17–20 / Night 20–5 — `lib/time-of-day.js`). The client picks the band from its own clock and calls `/api/hero-image?band=…`, which caches one photo per band per calendar day in `hero_image` — so a page load never hits Unsplash unless that band hasn't been fetched yet today (same discipline as the trip photo). No key / no result falls back to a per-band CSS gradient — never a broken image. The greeting uses `timeOfDayGreeting`; the quote is a generic, **unattributed** line from `lib/quotes.js` rotating once a day (John's call — no personal byline). Do **not** add fabricated Home metrics (a "daily focus %", per-card progress rings, weather) — they have no data source, the same reason the Language "weekly goal" ring was deleted; a Home stat must come from real data or not appear.

**Schedules vs Idea Board — the boundary is the due date, not topic.** Idea Board = no due date, "someday/maybe." Schedules = has a due date, actionable now. Kept as **separate tables** deliberately (`ideas` has no date column; `schedules.due_date` is `NOT NULL`). Do not merge them into one table with an optional date.

**Google Calendar is in scope; Google Drive is explicitly not.** Different APIs, different concerns. Only Calendar read access is needed (next Spanish tutor call, matched by host/keyword — no AI).

**Numeric-string coercion (Neon driver).** `NUMERIC`/`DECIMAL` columns (e.g. Travel `budget`) come back as strings. Coerce with `num()` from `lib/db.js` at the API boundary, never in a component.

## 8. Working in This Environment

_(Fill in as project-specific quirks surface — commit signing, Vercel preview lag, etc. Nothing project-specific known yet; greenfield.)_

## 9. Agentic Loop

Follow the Agentic Loop protocol ([Agentic-Loop repo](https://github.com/jonncy18-maker/Agentic-Loop)) for any change touching 3+ files, or introducing a new component, new data domain/table, or user-visible structural change.

## 10. References

- [Agentic-Loop repo](https://github.com/jonncy18-maker/Agentic-Loop) — shared development protocol
- `STACK_BLUEPRINT.md` — canonical stack/structure source (from NextGen-Immersion)
- Sibling repos for pattern reference: NextGen-Scholars, NextGen-Immersion (numeric-coercion gotcha; same-origin auth pattern — not used here)

**Cross-repo dependency (tracked in ROADMAP.md):** AI Projects' "Next Up" feature depends on each tracked repo having a standardized `## Next Up` section at the top of its `ROADMAP.md`. This convention does not yet exist in any sibling repo (NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning, Agentic-Loop) or the Stack Blueprint. Until retrofitted, "Next Up" renders as "—". Retrofit is a separate task from this dashboard's build.
