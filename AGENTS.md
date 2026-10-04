# Personal Dashboard

Master personal planning hub consolidating John's AI projects, travel, schedules, language learning, idea backlog, and email triage into one home. Built for a single user (John), no public access.

Shared project instructions for every coding agent (Claude Code, Codex, Antigravity). Each agent's role and permissions live in its own global file, not here.

> **Session start:** read `ARCHITECTURE.md` (system map, domain → route → data source) and the latest `ROADMAP.md` entry (recent decisions) before making structural changes. Older dated history (pre-2026-07-15) lives in `ROADMAP-ARCHIVE-2026-H1.md`.

- **Repo:** `jonncy18-maker/Personal-Dashboard`
- **Stack:** Next.js (App Router) + JavaScript (`.jsx`/`.js`) + React + Vercel (native Git integration) + Neon (own project, not shared with AI-Capital-Planning). Prettier: single quotes, semis, 80 cols. Styling: avoid the generic template look.
- **CI:** `.github/workflows/ci.yml` runs `npm test` and `npm run build` on every PR to `main`; `main` is protected and needs it green.
- **AI:** Claude Haiku (`claude-haiku-4-5`) for narrow jobs — most run on GPT-6 Luna when `OPENAI_API_KEY` is set (`lib/ai-models.js`); Claude Sonnet (`claude-sonnet-5`) for the AI Assistant only.
- **Deliberate divergences from the NextGen-Immersion gold standard** (don't "fix" them back): real App Router routes + `app/api/*` handlers instead of a HashRouter SPA shell; no auth (§ Hard boundaries).

## Env and secrets

Every key, its prefix, where it lives and why: `docs/api-keys.md` (template: `.env.example`). Set every var for **both Production and Preview** in Vercel explicitly — a var present only in Production makes Preview fail in a way that looks like a runtime bug. The Vercel API token must be read-only scope; never let it reach client code.

## Schema and migrations

No ORM. `neon/schema.sql` is the single source of truth for the current DB shape — read it, never reassemble state from migration history.

- Every change is a new numbered file in `neon/migrations/`. Applied migrations are immutable. All DDL is idempotent (`IF NOT EXISTS`, drop-and-recreate triggers).
- After applying one, update `schema.sql` to the sum of all migrations and bump its "Applied migrations:" line.
- No speculative tables for undecided domains — a new domain is a 2-file change (migration + `schema.sql`).
- **`npm run migrate` (`scripts/migrate.js`) applies pending migrations — run it explicitly, never automatically.** It is deliberately NOT in the Vercel build: Preview and Production share **one** Neon database, so an unmerged PR's schema change would land on live data the moment its preview builds. After merging a PR that adds a migration, run it (or ask Claude Code to, via the Neon MCP) before relying on the deployed code. Skipping this caused a real `/travel` outage (PR #29).
- Locally, point `DATABASE_URL` at the Neon `dev-local` branch (`.env.local`), never at `main`.

## Hard boundaries

A violation of these is a real incident, not a style disagreement. Each rule is stated once, here.

1. **No auth — don't add it back.** Single-user private app; the blueprint's Neon Auth pattern doesn't apply. Since 2026-09-17 Vercel Authentication is also deliberately off so claude.ai's OAuth connector can reach `/api/mcp/health`; the app is reachable by anyone with its `.vercel.app` URL, by design. `HEALTH_MCP_TOKEN` and the OAuth wrapper gate the MCP write tools. Don't re-enable Vercel Authentication to "fix" this.
2. **Gmail is read-only, full stop.** No code path may call a Gmail write/archive/delete/modify endpoint. "Hiding" an email only sets a local flag (`email_hidden`).
3. **No fabricated metrics.** A metric comes from real data or a field John maintains — if there's no data source, it doesn't appear.
4. **No AI import ever auto-saves.** Every AI import (Travel itinerary, French hours, Schedules screenshot, all of them) shows a preview for John to confirm or edit first. One exception (2026-07-15, reconfirmed 2026-10-03): approving a Gmail trip suggestion auto-imports that email's itinerary into the new trip; the Approve click is the confirmation, and the itinerary stays editable.
5. **The AI Assistant's tools are an allowlisted catalog of this app's OWN api routes, over same-origin fetch.** Never give it a direct DB handle, a raw-fetch tool, or a third-party API call. The app-wide MCP server (`/api/mcp/app`) reuses this exact catalog — extend it once in `lib/assistant.js` and both surfaces pick it up. One exception (2026-09-17): the Health tools (`lib/health-mcp-tools.js`) write to the DB directly, so the Assistant and both MCP servers share one implementation; they must mirror `app/api/health/*` validation exactly.
6. **Secrets stay server-side.** Anything touching the Vercel API, Neon, Google APIs, or the Anthropic/OpenAI API goes through an `app/api/*` route handler; the browser never calls them. No secret env var gets a `NEXT_PUBLIC_` prefix.
7. **Applied migrations are immutable** (see above).
8. **Coerce `NUMERIC`/`DECIMAL` with `num()` from `lib/db.js`** at the API boundary, never in a component (the Neon driver returns them as strings).

## Other cross-cutting rules

- **Schedules vs Idea Board: the boundary is the due date, not topic.** Idea Board = no due date; Schedules = has one (`schedules.due_date` is `NOT NULL`, `ideas` has no date column). Separate tables on purpose — don't merge them.
- **Google Calendar is in scope; Google Drive is not.** Only read access to Calendar is needed.
- **Conventions for the refresh signal, PWA/service worker, `PageBanner` headers and API error handling** live in `.claude/skills/frontend-conventions/SKILL.md`. The one to never forget: the service worker must never cache `/api/*`.
- **Model IDs in code stay pinned.** `lib/anthropic.js`'s `MODEL` and `lib/assistant.js`'s `ASSISTANT_MODEL` are API arguments and **must stay pinned to an exact ID** — a floating model would change behavior and cost with no deploy or diff. Moving them is a real change: bump the ID, note it in `ROADMAP.md`, say what you checked still worked.

## Coder Profile and Agentic Loop

From the [Agentic-Loop repo](https://github.com/jonncy18-maker/Agentic-Loop):

- **Coder Profile** — https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/CODER_PROFILE.md. Applies to **every task**; read it at the start of every session.
- **Agentic Loop** — https://raw.githubusercontent.com/jonncy18-maker/Agentic-Loop/main/AGENTIC_LOOP.md. Applies to changes touching 3+ files, or adding a component, data domain/table, or user-visible structural change.

## Map

Domain rules live in `.claude/skills/<name>/SKILL.md`; read the one for the domain you're touching before changing it. Skills: `health`, `car`, `travel`, `pto`, `email`, `assistant`, `ai-projects`, `language`, `home`, `schedules`, `geocoding`, `frontend-conventions`.

Other references: `STACK_BLUEPRINT.md` (canonical stack source), `docs/api-keys.md`, `docs/runbooks/google-oauth.md` (the 7-day refresh-token trap), `ROADMAP-ARCHIVE-2026-H1.md`. Cross-repo: AI Projects' "Next Up" line needs a `## Next Up` section at the top of each tracked repo's `ROADMAP.md` (not yet retrofitted; renders "—" until then).

**Keep this file short — it is a maintenance rule.** Before adding anything, ask: does it change how code is written outside one domain? If it only matters in one domain, it goes in that domain's skill. A procedure John runs goes in `docs/`. A dated account of why a decision was made goes in `ROADMAP.md`. Anything only Claude Code needs goes in `CLAUDE.md`. State each rule once, and never put agent permissions (push, merge, deploy) here.
