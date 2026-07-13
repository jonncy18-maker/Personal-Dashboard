# Roadmap / Session Log

Dated history and session-by-session notes live here, not in `CLAUDE.md`. `CLAUDE.md` stays a living reference; this file is the narrative.

---

## Open / Tracked To-Dos

_(Not dated history — live items that outlast a single session. Remove when done.)_

- [ ] **`## Next Up` retrofit across sibling repos.** AI Projects' "Next Up" line parses a standardized `## Next Up` section at the top of each tracked repo's `ROADMAP.md`. This convention does not yet exist anywhere. Retrofit it into: **NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning, Agentic-Loop**, and the Stack Blueprint itself. Until done, "Next Up" renders as "—". Separate task from this dashboard's build.
- [ ] Confirm Vercel API token scope is read-only when provisioning.
- [ ] Record exact Vercel project slugs/IDs and repo names to track in AI Projects.

---

## 2026-07-13 — Grill session #2 + base scaffold finalized (pre-first-commit)

Reviewed the initial draft docs (README, ROADMAP, CLAUDE) against the NextGen-Immersion gold standard before the first commit. Locked the clean base and corrected several defects/decisions.

**File defects fixed:**

- CLAUDE.md had a duplicated header block (a stale 5-domain version stacked on the 6-domain version) — removed the stale copy.
- README said "Five domains" and listed only three env vars — updated to six domains + the real env set.
- Dangling `§7`/`§9`/`§10`/`Part` cross-references — CLAUDE.md now uses real numbered sections.
- Repo name filled in everywhere: `jonncy18-maker/Personal-Dashboard`.

**Decisions locked:**

- **Language: JavaScript (`.jsx`/`.js`)**, matching the gold standard — the earlier "TypeScript preferred" claim was wrong (the canonical sibling is JS).
- **Routing: App Router** (not the gold standard's HashRouter-SPA-in-Next shell). Documented as a deliberate divergence — greenfield, no Vite-SPA legacy to carry.
- **Auth: removed entirely.** Single-user private app; the blueprint's same-origin Neon Auth pattern doesn't apply. Documented so a future session doesn't reintroduce it. Gate at the Vercel project level if needed.
- **Gmail: real Google OAuth** (client id/secret/refresh token), read-only — dropped the earlier vague "MCP connector" language, which can't work from a deployed app.
- **Email redesign — AI-minimal:** Tier 1 = no AI (deterministic sender parse). Gmail-native categories/operators do the fuzzy work for free. Haiku used only for the Tier 2 semantic residual. Onboarding scan = frequency `GROUP BY`, no AI, one-time (tracked in `app_flags`). Travel itinerary import stays on Haiku (genuine extraction).
- **CI: Vercel-native Git integration**, no GitHub Actions workflow.
- **Docs: added a stubbed `ARCHITECTURE.md`; skipped `UPDATES.md`** (a user-facing changelog is redundant when the only user is the developer).
- **Schema: settled domains now, undecided ones deferred.** Wrote `neon/migrations/001_initial.sql` (projects, trips, schedules, ideas, email_rules, email_hidden, app_flags) + canonical `neon/schema.sql`. Language Learning left table-less by design. Established a lightweight numbered-migration convention (see CLAUDE.md §6) so adding domains later is a 2-file operation, not a guess made up front.

**Base scaffold committed:** package.json, next.config.js, prettier.config.js, .gitignore, vercel.json, .env.example, lib/db.js, lib/anthropic.js, neon schema + migration, plus STACK_BLUEPRINT.md copied from the canonical NextGen-Immersion source.

---

## 2026-07-12 (cont'd) — Grill session: Travel, Schedules, Email finalized — all 6 domains now fully scoped

Continued the same-day grill session. Started from Travel (still unscoped) and ended with every domain specified — nothing left open for Build to guess at.

**Key structural insight — Schedules redefined:** John initially wanted trip-prep tasks (e.g. the DJI purchase timed to the October trip) tracked inside Travel. Recognized this wasn't Travel-specific — it's a general "things to do by a date" need that applies across domains. This became the actual definition of **Schedules**: a cross-domain task list with an optional link to a Travel trip or AI project, distinguished from **Idea Board** purely by the presence of a due date (Idea Board = no date, "someday/maybe"; Schedules = has a date, actionable now). This resolved two previously-unscoped domains as one clarified concept.

**Travel (fully specified):**

- Trip records: destination, dates, status (upcoming/past), notes, optional budget figure. No Idea Board link (considered, dropped for v1).
- Card view stays minimal (per the pattern used everywhere else); click into a trip for full itinerary detail — day-by-day/port structure, not shown on the summary card.
- **Itinerary import is AI-assisted, a third distinct AI use pattern (see below).**

**Schedules (fully specified):**

- Fields: title, notes, due date, status, optional link (Travel trip / AI project / none) — same shape regardless of whether linked or standalone.
- A linked item's own card shows a small indicator (e.g. a dot) when it has open Schedules tasks — one-directional visibility via a lightweight badge, not a full task list embedded on other cards.

**Email — categorization buckets resolved, onboarding scan added:**

- An "Action Needed / FYI / Promotional" bucket system was proposed, then tested against a real Gmail sample (50 recent threads pulled live). The sample showed the actual problem is volume from a small set of noisy senders (cruise-line marketing, retail blast emails — Carnival, Royal Caribbean, BestBuy, Costco, JCPenney, etc.), not a need for a labeling taxonomy. **Decision: no categorization buckets** — the already-locked Tier 1/2 hide-rule system is sufficient; what remains after hiding renders as a plain list.
- **New: first-run onboarding scan.** On first visit to `/email`, recent senders are scanned and a batch of likely Tier 1 hide-rule candidates is proposed for one-pass approve/reject. Explicitly a one-time feature — must not re-run on every visit. _(Later refined 2026-07-13: this scan is a frequency `GROUP BY`, not an AI call.)_

**New AI use pattern — Travel itinerary import (third distinct pattern, alongside Email's Tier 1/Tier 2):**

- Flow: John triggers import on a trip → Claude Haiku searches Gmail (read-only) for a likely matching confirmation/itinerary email → if confident, parses it; if not confident, asks John for help identifying the right email → shows a **preview of parsed itinerary for John to confirm/edit before saving** (never auto-saves).
- This is a one-shot extraction-and-confirm pattern, structurally different from both email tiers (not a standing filter rule, not a per-message ongoing judgment) — a third pattern, not a variant of the first two.

**Status: all 6 domains (Home, AI Projects, Travel, Schedules, Language Learning, Idea Board, Email — 7 routes, 6 conceptual domains) are now fully specified.** No remaining "not yet decided" items block starting Build, aside from the housekeeping items now tracked at the top of this file.

---

## 2026-07-12 — Grill session: AI Projects, Idea Board, Language, Email fully scoped

Full pass through several domains via structured grilling, following up on the initial scoping session earlier the same day. Decisions locked:

**AI Projects (fully specified):**

- Home page shows one status card for the whole domain; clicking opens a popup listing every tracked project
- Each project card sources **Vercel** deploy status + live link (when a Vercel project exists) OR shows a "protocol/library" badge + GitHub link (when it doesn't — e.g. Agentic-Loop, which is a protocol repo with no deployment)
- Each card also shows a **"Next Up"** line — this comes from **GitHub**, not Vercel, specifically parsed from a new standardized `## Next Up` section to be added at the top of each tracked repo's `ROADMAP.md`. This is a retrofit needed across sibling repos (tracked at the top of this file) — it doesn't exist yet anywhere.
- "Add Project" flow: **two explicit fields**, GitHub URL (required) + Vercel URL (optional, blank = protocol-only). Auto-detection was considered and explicitly rejected in favor of this simpler, unambiguous input.

**Idea Board (fully specified):**

- Fields: title, notes, status (open/in progress/done), domain tag (AI Projects / Travel / Schedules / Language / General)
- No promotion path to AI Projects — Idea Board and AI Projects stay fully separate, by design

**Language Learning (partially specified — mostly "coming soon"):**

- Full domain page is a placeholder for now — John hasn't decided the broader shape yet
- One concrete v1 piece: a card showing the **next scheduled Spanish tutor call**, sourced from **Google Calendar** (read-only), identified by a simple keyword/host match (e.g. "italki") in the event title — **no AI needed** for this specific match
- Clarified: Google **Drive** stays fully excluded from this project, but Google **Calendar** is a distinct API/service and is fine to use here

**Email (new 6th domain, fully specified):**

- Source: Gmail only — **strictly read-only**, no archive/delete/modify calls ever. "Hiding" an email only sets a local flag in this app's own database; the real Gmail mailbox is untouched.
- **Tier 1 — sender rules:** clicking "X" on an email creates a structured, deterministic sender-hide rule (e.g. "hide all future emails from dominos.com"). After creation, filtering is a plain database check. _(Refined 2026-07-13: no AI needed — sender is parsed directly from the header.)_
- **Tier 2 — content rules:** for senders John generally wants but sometimes doesn't (e.g. his bank sending both statements and promotional content). A "manage sender" action lets him type a plain-language rule; evaluated per future email from that sender. _(Refined 2026-07-13: Haiku used only for the semantic residual Gmail's native categories can't express.)_
- Both tiers get a management view (list of active rules, with undo/delete).

**Not yet decided as of this entry (resolved later — see entries above):**

- Travel domain, Schedules domain — completely unscoped
- Email inbox's initial categorization buckets — resolved (no buckets)
- Exact Vercel slugs/IDs, repo name/location — repo name now resolved

---

## 2026-07-12 — Project scoped

Scoped conversationally before any code was written. Key decisions locked at scoping time:

- **Structure:** home page with a status card per domain, each linking into a full domain page (not one unified page, not fully separate unlinked apps)
- **Five domains (later became six):** AI Projects, Travel, Schedules, Language Learning, Idea Board
- **AI Projects domain:** sources live status from the **Vercel API** (`list_projects`, `get_project`, `list_deployments`) — not GitHub as a commit/issue tracker. _(Note: GitHub re-entered later for "Next Up" parsing — a different purpose.)_
- **Travel / Schedules / Language Learning:** intentionally minimal/placeholder in v1 — no schema investment until real usage clarifies what each needs
- **Stack:** Next.js + Vercel + new standalone Neon project, built to the `STACK_BLUEPRINT.md` reference patterns _(auth later dropped — see 2026-07-13)_
- **No Google Drive / Cross-Project Log involvement** — explicitly out
- **Agentic Loop:** referenced as a linked protocol only, not pasted in full

---

## Template for future entries

```
## YYYY-MM-DD — Short title

What changed, what was decided, why. Link related commits/PRs if applicable.
```
