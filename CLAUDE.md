# Personal Dashboard

Master personal planning hub consolidating John's AI projects, travel, schedules, language learning, idea backlog, and email triage into one home. Built for a single user (John), no public access.

> **Session start:** read `ARCHITECTURE.md` (system map) and the latest `ROADMAP.md` entry (recent decisions) before making structural changes. Older dated history (pre-2026-07-15) lives in `ROADMAP-ARCHIVE-2026-H1.md`.
>
> **Personal context:** John maintains a dated personal-context doc (background,
> constraints, review priorities as the builder — not this repo's rules) in Google
> Drive: https://drive.google.com/drive/folders/1cjNFhY6ZnN5xB4PSDhz7FA24KGl92NTy —
> titles are date-stamped (e.g. `Personal_Context_YYYY-MM-DD.md`). At session start,
> or whenever asked to review this repo "against what you know about me," use the
> Google Drive tools to find the **most recently dated** file in that folder (don't
> assume a fixed filename) and weigh suggestions against it, not just generic best
> practice. Nothing is committed to this repo for this — the Drive folder is the only
> source of truth, so it's always current.

- **Repo:** `jonncy18-maker/Personal-Dashboard`
- **Live URL(s):** _(fill in after first Vercel deploy)_
- **Stack:** Next.js (App Router) + JavaScript + Vercel + Neon
- **Cutover:** N/A — greenfield project, scoped July 2026

## 1. Stack

| Layer      | Choice                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js (App Router)                                                                                                        |
| Frontend   | React                                                                                                                       |
| Routing    | Next.js App Router (file-based) — one route per domain under `app/`                                                         |
| Language   | **JavaScript (`.jsx`/`.js`)** — matches the NextGen-Immersion gold standard                                                 |
| Styling    | _(Claude Code's judgment — follow `frontend-design` skill, avoid generic template look)_                                    |
| Database   | Neon (new, separate project — not shared with AI-Capital-Planning)                                                          |
| Auth       | **None — deliberately dropped.** See §7.                                                                                    |
| Hosting    | Vercel (native Git integration — no CI workflow)                                                                            |
| Formatting | Prettier — config copied verbatim from the gold standard (single quotes, semis, 80-col)                                     |
| AI         | Claude Haiku (`claude-haiku-4-5`) — narrow uses; Claude Sonnet (`claude-sonnet-5`) — the app-wide AI Assistant only; see §7 |

**Two deliberate divergences from the NextGen-Immersion gold standard, documented so a future session doesn't "fix" them back:**

1. **App Router, not a HashRouter SPA.** The gold standard is a Vite SPA migrated into a Next shell (`app/page.jsx → dynamic(App,{ssr:false})` + `pages/api/*`). This is greenfield with no SPA legacy, so it uses real App Router file-based routes and `app/api/*` route handlers. The blueprint's SPA-shell `next.config.js` rewrite is intentionally absent.
2. **No auth.** The blueprint calls same-origin Neon Auth "the single highest-value pattern to copy." It does not apply here: this is a single-user private app. Auth (and `better-auth`/`jose`/`@neondatabase/auth`) is deliberately omitted. Do not add it back — gate access at the Vercel project level if needed.

No migration history — this is a new project, built directly to this stack from day one.


## 2. API Key / Security Rules

The full key table (every key, its prefix, where it lives, and why) is in `docs/api-keys.md`.

**Rule:** anything that touches the Vercel API, Neon connection, Google APIs, or Anthropic API goes through a server-side route handler (`app/api/*`); the browser never calls any of these directly. No env var carrying a secret gets a `NEXT_PUBLIC_` prefix.

**Rule:** the Gmail integration is **read-only by design**. No code path may call a Gmail write/modify/delete endpoint. "Hiding" an email only sets a local flag in this app's own Neon database (`email_hidden`); the actual Gmail mailbox is never touched.

**The Vercel API token is a real secret with write-capable scope if over-provisioned.** Scope it read-only in Vercel's token UI if possible, and never let it reach client code. A leaked deploy-capable token is a materially worse failure than a leaked read-only one.

## 3. Project Structure

_(Expected shape given domain-per-route App Router. Claude Code populates real paths during Build.)_

```
app/
  page.jsx                 # Home — status cards for all 6 domains
  ai-projects/page.jsx     # AI Projects — popup w/ project cards (Vercel + GitHub) + Add Project
  travel/page.jsx          # Travel — trip records + AI-assisted Gmail itinerary import
  mileage/page.jsx         # Mileage — Tesla lease odometer log, trip journal, checkpoint forecast
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
GOOGLE_MAPS_API_KEY=       # Geocoding API — Travel map/country stats + Mileage places/trips/legs

# Client-side (public-prefixed)
NEXT_PUBLIC_APP_URL=       # Same-origin base URL
```

**Gotcha:** per Stack Blueprint Part 2, set every one of these for both **Production and Preview** in Vercel explicitly — a var present only in Production makes Preview deploys fail in a way that looks like a runtime bug, not a config bug.


## 5. Routes / Pages

| Route          | Component         | Role                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`            | Home dashboard    | Status cards, one per domain (6), linking into each domain's page                                                                                                                                                                                                                                                                                                                              |
| `/ai-projects` | AI Projects       | Popup lists all tracked projects. Each: Vercel deploy status + live link (if a Vercel URL is set) OR a "protocol/library" badge + GitHub link (if not). Each card shows a "Next Up" line parsed from that repo's `ROADMAP.md`. "Add Project" = two fields (GitHub URL required, Vercel URL optional)                                                                                           |
| `/travel`      | Travel            | Trip records (destination, dates, status, notes, optional budget). Click into a trip for full day-by-day/port itinerary (AI-assisted Gmail import — §7). No Idea Board link in v1. Also hosts the **PTO Planner** panel — a self-set annual PTO budget, auto-derived from trips, plus a separate banked-holiday ledger and a read-only simulation layer (§7). Not a 7th domain                 |
| `/mileage`     | Mileage           | The 7th domain — Tesla lease mileage tracker/forecaster. A dated odometer log is the ground truth for miles driven; a point-to-point trip journal (geocoded + OSRM-routed) is a supplementary log, never summed into the odometer total. Three lease checkpoints (1/2/3-yr) project miles vs. allowance from the current pace plus any John-checked named scenarios. No AI — see §7            |
| `/schedules`   | Schedules         | Cross-domain task/prep list (title, notes, due date, status, optional link to Travel trip / AI project). A linked item's card shows a small indicator when it has open Schedules tasks. Distinct from Idea Board by having a due date                                                                                                                                                          |
| `/language`    | Language Learning | Two different shapes, not one. **French** (active learning): hours logged via a screenshot import of Dreaming French's progress page (Haiku vision, preview-confirm-before-save). **Spanish** (already C1, ambient daily immersion): the live next-tutor-call card (Google Calendar, host/keyword match, no AI) plus an editable freeform note — no hours metric, since there's nothing to log |
| `/ideas`       | Idea Board        | CRUD — title, notes, status, domain tag. No promotion path to AI Projects. Distinct from Schedules by having no due date                                                                                                                                                                                                                                                                       |
| `/email`       | Email             | Read-only Gmail triage. No categorization buckets. Tier 1 + Tier 2 hide rules (§7). Management view lists both tiers w/ undo/delete. First-run onboarding scan (§7)                                                                                                                                                                                                                            |


## 6. Schema & Migrations

Lightweight convention — no ORM (overkill for one user), but a small runner closes the "migration file merged, database never updated" gap:

- **`neon/schema.sql` is the single source of truth** for the current DB shape. Read that one file; never reassemble state from migration history.
- **Every change is a new numbered file** in `neon/migrations/` (`001_initial.sql`, `002_*.sql`, …). Applied migrations are **immutable** — never edit one. A later change (settling Language, adding a new domain) is always a new file.
- **After applying a migration, update `schema.sql`** to reflect the sum of all migrations, and bump its "Applied migrations:" line.
- **All DDL is idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS` + recreate). Re-running a migration is always safe.
- **Settled domains have tables now; undecided ones don't.** Language Learning's core "next tutor call" still reads live from Calendar, but migration 011 added tables for the one settled v1 slice (French hours log + per-language note) — see §7. Do not add speculative tables beyond a settled slice — a new domain later is a 2-file operation (new migration + update `schema.sql`), not something to pre-guess.

**`npm run migrate` (`scripts/migrate.js`) applies pending migrations — run it explicitly, never automatically.** It tracks applied files in a `schema_migrations` table and runs any `neon/migrations/*.sql` not yet recorded, in filename order. It is a plain script, not a framework (no Prisma/Drizzle) — splitting each file into individual statements itself, since the Neon serverless driver accepts one statement per call.

**Deliberately NOT wired into the Vercel build.** Surfaced 2026-07-15/16: Preview and Production deployments share **one** Neon database here (no per-branch DB). Auto-running migrations on every build — the normal move for apps with a branched/staging DB — would mean an unmerged, unreviewed PR's schema change lands on the live database the moment its preview builds. Instead: **after merging a PR that adds a migration, run `npm run migrate` (or ask Claude Code to, via the Neon MCP) before relying on the deployed code that needs it.** This was a real outage during the Travel redesign (PR #29): the code shipped expecting new columns that didn't exist yet in Neon, and `/travel` 500'd until the migration was applied by hand.


## 7. Hard Boundaries

These are the rules where a violation is a real incident, not a style disagreement — the fuller reasoning for each lives in the skill or section noted in the Map (§11).

1. **No auth — and don't add it back.** Single-user private app; if access needs gating, do it at the Vercel project level, not by reintroducing an auth layer.
2. **Gmail access is read-only, full stop.** No code path may call a Gmail write/archive/delete/modify endpoint — "hiding" an email only sets a local flag. Hard boundary, not a revisitable default.
3. **No fabricated metrics.** A metric comes from real data or a field John maintains, never a hardcoded number — if there's no data source, it does not appear.
4. **No AI import ever auto-saves.** Every AI import shows a preview for John to confirm/edit before saving — Travel itinerary, French hours, Schedules screenshot, all of them.
5. **The AI Assistant's tools are an explicit allowlisted catalog of this app's OWN api routes, called over same-origin fetch.** Never give it a direct DB handle, a raw-fetch tool, or a third-party API call.
6. **No env var carrying a secret gets a `NEXT_PUBLIC_` prefix**, and anything that touches the Vercel API, Neon connection, Google APIs, or Anthropic API goes through a server-side route handler (`app/api/*`) — the browser never calls any of these directly.
7. **Applied migrations are immutable** — never edit one; every change is a new numbered file in `neon/migrations/`.
8. **Coerce `NUMERIC`/`DECIMAL` columns with `num()`** from `lib/db.js` at the API boundary, never in a component.

## 8. Cross-Cutting Rules

**No auth — and don't add it back.** Single-user private app. The blueprint's same-origin Neon Auth pattern does not apply here. If access needs gating, do it at the Vercel project level, not by reintroducing an auth layer.

**Schedules vs Idea Board — the boundary is the due date, not topic.** Idea Board = no due date, "someday/maybe." Schedules = has a due date, actionable now. Kept as **separate tables** deliberately (`ideas` has no date column; `schedules.due_date` is `NOT NULL`). Do not merge them into one table with an optional date.

**Google Calendar is in scope; Google Drive is explicitly not.** Different APIs, different concerns. Only Calendar read access is needed (next Spanish tutor call, matched by host/keyword — no AI).

**Numeric-string coercion (Neon driver).** `NUMERIC`/`DECIMAL` columns (e.g. Travel `budget`) come back as strings. Coerce with `num()` from `lib/db.js` at the API boundary, never in a component.

**App-wide refresh signal.** The TopBar refresh button drives `lib/refresh.jsx` (`RefreshProvider`/`useRefresh`, wrapping the shell in `AppShell`): calling `refresh()` bumps a `refreshKey` that `useHomeSummary` and `useResource` re-fetch on. A new data hook should subscribe to `useRefresh()` so the button covers it. All six domain pages now read through `useResource` (Travel, Email, Ideas, Schedules were migrated 2026-07-17), so the refresh button covers every page. Pages with optimistic mutations mirror the hook's `data` into local state via an effect and call the hook's `reload()` after a persist — keep that pattern when adding a page.

**PWA — installable, and data stays live.** `app/manifest.js` (→ `/manifest.webmanifest`) + `public/sw.js` (registered by `components/RegisterSW.jsx`, production only) make the app installable. The service worker is deliberately conservative: cache-first for hashed static assets, network-first for pages, and **API routes are never cached** — this app depends on fresh reads and the refresh button assumes them. Never make the SW cache `/api/*`. Icons live in `public/icons/` (the "Horizon" mark; `app/icon.png` is the favicon).

**API error-handling convention — two shapes, one boundary.** _User-input CRUD routes_ (`trips`, `ideas`, `schedules`, `projects` + their `[id]` variants, `home-summary`) wrap their handler in `route()` from `lib/route.js` so an unexpected throw returns a JSON `{ error }` 500 the client can parse — not an opaque framework error page. Validation still returns explicit `400`/`404` from inside the handler. _External-source routes_ (`github`, `vercel`, `gmail`, `calendar`, the AI routes) instead **fail soft**: they catch internally and return the success shape with `null`/`[]` payloads (a dead repo or missing token must never break the view). When adding a route, pick the matching pattern. On the client, every fetch must check `res.ok` before trusting the body — a non-2xx body is an error payload, not data. Shared client fetching goes through `useResource()` (`lib/useResource.js`); pages with optimistic mutations keep local state but must revert it on a failed persist.

## 9. Coder Profile & Agentic Loop

Two layers, both from the [Agentic-Loop repo](https://github.com/jonncy18-maker/Agentic-Loop):

- **Coder Profile** — https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/CODER_PROFILE.md
  Applies to **every task, no threshold**. Governs how code is written and how it gets verified. Read it at the start of every session.
- **Agentic Loop protocol** — https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/AGENTIC_LOOP.md
  Applies to any change touching 3+ files, or introducing a new component, new data domain/table, or user-visible structural change. Governs whether the right thing was built.

A change small enough to skip the loop is still governed by the profile.

## 10. References

- [Agentic-Loop repo](https://github.com/jonncy18-maker/Agentic-Loop) — shared development protocol and coder profile
- `STACK_BLUEPRINT.md` — canonical stack/structure source (from NextGen-Immersion)
- Sibling repos for pattern reference: NextGen-Scholars, NextGen-Immersion (numeric-coercion gotcha; same-origin auth pattern — not used here)

**Cross-repo dependency (tracked in ROADMAP.md):** AI Projects' "Next Up" feature depends on each tracked repo having a standardized `## Next Up` section at the top of its `ROADMAP.md`. This convention does not yet exist in any sibling repo (NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning, Agentic-Loop) or the Stack Blueprint. Until retrofitted, "Next Up" renders as "—". Retrofit is a separate task from this dashboard's build.

## 11. Map

Domain rules live in `.claude/skills/`, which load themselves when the matching files are touched; this map is the fallback pointer if a skill doesn't fire.

- `.claude/skills/mileage/SKILL.md` — Mileage: odometer ground truth, checkpoints, usual trips, favorite places, leg scenarios, travel day exclusions
- `.claude/skills/travel/SKILL.md` — Travel: itinerary import, destination photo, geocoded map pins, the retired AI Brief
- `.claude/skills/pto/SKILL.md` — PTO Planner: the self-set budget, banked-holiday ledger, simulation layer, net glance figure
- `.claude/skills/email/SKILL.md` — Email: Tier 1 / Tier 2 rules, Gmail-native categories, onboarding scan
- `.claude/skills/assistant/SKILL.md` — AI Assistant: tool catalog, model choice, attachments, cut-off handling
- `.claude/skills/ai-projects/SKILL.md` — AI Projects: GitHub vs Vercel, Add Project, the thin manual layer
- `.claude/skills/language/SKILL.md` — Language: French hours import vs Spanish's ambient note
- `.claude/skills/home/SKILL.md` — Home: time-of-day hero photo, daily quote, no fabricated metrics
- `.claude/skills/schedules/SKILL.md` — Schedules: the AI screenshot import
- `.claude/skills/geocoding/SKILL.md` — Geocoding: the Google Geocoding API, shared by Travel and Mileage
- `docs/api-keys.md` — the full API key table (§2's rules stay in this file)
- `docs/runbooks/google-oauth.md` — the Google refresh-token 7-day trap and the re-mint runbook
- `ROADMAP-ARCHIVE-2026-H1.md` — dated ROADMAP entries before 2026-07-15
