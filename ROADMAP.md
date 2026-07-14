# Roadmap / Session Log

Dated history and session-by-session notes live here, not in `CLAUDE.md`. `CLAUDE.md` stays a living reference; this file is the narrative.

---

## Open / Tracked To-Dos

_(Not dated history — live items that outlast a single session. Check `[x]` the box the session a step is completed, noting the date; remove the line once it's no longer useful context.)_

- [ ] **`## Next Up` retrofit across sibling repos.** AI Projects' "Next Up" line parses a standardized `## Next Up` section at the top of each tracked repo's `ROADMAP.md`. This convention does not yet exist anywhere. Retrofit it into: **NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning, Agentic-Loop**, and the Stack Blueprint itself. Until done, "Next Up" renders as "—". Separate task from this dashboard's build.
- [ ] Confirm Vercel API token scope is read-only when provisioning — optional now (see 2026-07-14 entry below): unblocks the live Ready/Building/Failed status pill only, no longer required for the card's link to appear at all.
- [x] Record exact Vercel project slugs/IDs and repo names to track in AI Projects — 2026-07-14. Added NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning (all with their `-jonncy18.vercel.app` domains), and Agentic-Loop (GitHub only, no deployment). Deliberately left out Personal Dashboard itself and the private `Projects-Dashboard` repo (John's call — not one of the four sibling repos CLAUDE.md names).
- [x] Provision Google OAuth (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`) in Vercel — 2026-07-14. Verified end-to-end against both Calendar and Gmail (both scopes granted in one consent pass). Still blocks Travel's AI-assisted Gmail itinerary import (not built yet) and Email's Tier 2 + onboarding scan (not built yet — Tier 1 doesn't need it).
- [ ] Provision `UNSPLASH_ACCESS_KEY` in Vercel — blocks Travel's destination photo auto-fetch; falls back to the plain accent gradient without it.
- [x] Build Email's Tier 2 (Haiku semantic residual rules) — 2026-07-14, see entry below. First-run onboarding scan is still deferred (separate feature, not bundled in).
- [ ] Build Email's first-run onboarding scan (frequency `GROUP BY`, one-time, tracked via `app_flags`) — proposes likely Tier 1 candidates on first `/email` visit. Not AI, not blocked on anything; just not built yet.

---

## Future Domain Ideas (unscoped)

_(Candidates for a future domain/card — not yet grilled. Do not build schema or UI for these until a scoping session resolves the open questions, per the project's own convention of scoping before Build.)_

- [ ] **Health & Fitness card/subsection.** Raised 2026-07-13, not yet scoped. Open questions for a future grill session: Is this a 7th full domain (own route, own table) or a card/section within an existing domain (e.g. Home)? What's the data source — manual entry, or an integration (Apple Health, a wearable API, etc.)? What's the minimal v1 slice, matching how Language and Email started as a single live card before expanding?

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

## 2026-07-14 — AI Projects domain built (first real domain page)

Replaced the `/ai-projects` "Coming Soon" stub with the actual domain, per its CLAUDE.md §5/§7 spec. Chosen as the next roadmap item because it's listed first in every domain ordering (README, ARCHITECTURE, route table), the README's own "Status" note already described it as intended to be "the most built-out domain," its schema (`projects` table) has existed since `001_initial.sql`, and — unlike Travel/Language/Email — it needs no Google OAuth setup, just the already-scoped read-only `VERCEL_API_TOKEN`.

**Built:**

- `app/api/projects/route.js` — GET (list) / POST (create) against the `projects` table. `POST` validates `github_url` is required and matches `https://github.com/owner/repo`; `vercel_url` stays optional, exactly the two-field "Add Project" flow the spec calls for (no auto-detection).
- `app/api/github/route.js` — public, unauthenticated GitHub Contents API call per project, parses the `## Next Up` section out of that repo's `ROADMAP.md`. Renders "—" (via `null`) when the section doesn't exist yet, per the cross-repo dependency tracked below — confirmed live against `Agentic-Loop`, which doesn't have the section yet, so this returns `null` today as expected.
- `app/api/vercel/route.js` — server-side, read-only Vercel API proxy gated on `VERCEL_API_TOKEN`. Resolves a tracked `vercel_url` to a Vercel project (by name guess, falling back to a deployment-alias search) and returns its latest deployment's `readyState` + live URL. Returns `{status: null}` gracefully if the token isn't configured — never a broken page.
- `app/ai-projects/page.jsx` (+ `page.module.css`) — client component: card grid per tracked project (GitHub link, Vercel status pill or a "Protocol / library" badge, Next Up line), plus the Add Project form (two fields, inline, no modal library).

**Verified:** `next build` succeeds; dev server confirms the GitHub route's live network parse of `## Next Up` against a real sibling repo. The Neon-backed `/api/projects` route couldn't be exercised end-to-end in this sandbox (no live `DATABASE_URL` available) — the query matches the same `getDb()` pattern already used elsewhere, but running it against a real Neon project is unverified.

**Left for a later session:** Home page's project count card still reads from `lib/mock-data.js`, not `/api/projects` — wiring the Home summary to real domain data is its own cross-cutting task, not bundled into this one. No delete/untrack action was added (spec only calls for "Add Project").

---

## 2026-07-14 — Travel domain built (trip CRUD + itinerary editor)

Next roadmap item after AI Projects, following the README/ARCHITECTURE domain ordering. Built the core of Travel per `CLAUDE.md` §5/§7: trip records with the day-by-day itinerary detail view. Deliberately scoped out the AI-assisted Gmail itinerary import, since `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` aren't provisioned yet (tracked above) — manual entry covers the same data shape (`trips.itinerary` jsonb) in the meantime, so nothing about the schema or API needs to change once Gmail import lands.

**Built:**

- `lib/unsplash.js` — one-call-per-trip-change destination photo fetch, gated on `UNSPLASH_ACCESS_KEY`; returns `null` (never throws) if the key is absent or the search fails, so trip creation/editing is never blocked on it.
- `app/api/trips/route.js` (GET/POST) and `app/api/trips/[id]/route.js` (GET/PATCH/DELETE) — full trip CRUD against the `trips` table. On create, or on edit when the destination changes while `image_source` stays `'auto'`, the route calls Unsplash server-side and caches `image_url`/`image_attribution` on the row, exactly as specified — never on page load, never client-triggered. Setting `image_source: 'manual'` (or just supplying `image_url` directly) skips the Unsplash call entirely and is never overwritten by a later auto-refresh.
- `app/travel/page.jsx` — trip grid (photo, status pill, dates) + inline Add Trip form (destination required; dates, budget, notes optional).
- `app/travel/[id]/page.jsx` — trip detail: editable fields, a manual day-by-day itinerary editor (date/title/notes, add/remove rows), delete trip. A disabled "Import from Gmail" affordance documents why it's not wired up yet rather than silently omitting it.

**Verified:** `next build` succeeds. Neon-backed queries verified directly against the `personal-dashboard` project via the Neon MCP (insert with all fields, `jsonb` itinerary update, delete) — confirms the query shapes the API routes use are correct. Could not exercise the Next.js dev server against real Neon in this sandbox (its network egress proxy blocks the Neon host directly, same limitation noted in the AI Projects entry); the actual API-route code path is unverified end-to-end outside of Vercel.

**Left for later:** Gmail-assisted itinerary import (needs the OAuth to-do above), Home/Sidebar still read trip data from `lib/mock-data.js` rather than `/api/trips` (same cross-cutting wiring gap noted for AI Projects — not bundled into single-domain PRs).

---

## 2026-07-14 — Google Calendar wired up (Language's next tutor call)

John asked to hook up Gmail and Google Calendar. Split the work: the OAuth credential setup (Google Cloud Console project, enabling the Calendar + Gmail APIs, generating a Client ID/Secret, and minting a refresh token via the OAuth Playground) has to happen in John's own browser/Google account — not something this session can do on his behalf. Scoped the code side to Calendar first, since it's the smaller surface (one read-only endpoint, no new DB tables) and proves the shared OAuth plumbing before building out the much larger Email domain (Tier 1/2 hide rules, onboarding scan) on top of Gmail.

**Built:**

- `lib/google.js` — shared OAuth2 client (`googleapis`, already a dependency), gated on `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` all being present. Returns `null` rather than throwing when unconfigured, so both Calendar and (later) Gmail callers degrade the same way the Vercel/Unsplash integrations already do.
- `app/api/calendar/route.js` — read-only. Lists upcoming primary-calendar events and finds the next Spanish tutor call via a plain keyword match ("italki") against the event title/location/description/hangout link — no AI, per CLAUDE.md Language. Returns `{configured: false}` when credentials aren't set, distinct from `{nextCall: null}` (configured, but nothing upcoming matched) so the UI can show the right message either way.
- `app/language/page.jsx` (+ `page.module.css`) — replaces the Coming Soon stub. Still mostly a placeholder (Language's broader shape is unscoped, per CLAUDE.md), but now has the one live piece the spec calls for: a card showing the next tutor call, or a clear "not connected yet" / "nothing found" state.

**Verified:** `next build` succeeds; `/api/calendar` confirmed returning `{"nextCall":null,"configured":false}` against a local dev server with no Google credentials set — the graceful-degradation path works. The actual Calendar API call is unverified end-to-end since `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` aren't provisioned yet (tracked above).

**Left for later:** Gmail (Email domain) — deliberately not started this session; it's a much bigger build (two-tier hide rules, onboarding scan, `email_rules`/`email_hidden` tables already exist in schema) better done as its own slice once Calendar is proven working end-to-end with real credentials. Travel's Gmail-assisted itinerary import also still blocked on the same OAuth setup.

---

## 2026-07-14 — Email domain, Tier 1 (Gmail read + sender-hide rules)

John's Google OAuth setup (Client ID/Secret/refresh token, granted with both `calendar.readonly` and `gmail.readonly` in one consent pass) is confirmed working end-to-end — verified live in production via `/api/calendar`. That unblocked Email. Scoped to **Tier 1 only** this session (John's call, mirroring the earlier "Calendar first" decision): proves the Gmail read path and the deterministic sender-hide-rule flow before adding the AI-dependent Tier 2 layer and the onboarding scan on top. `ANTHROPIC_API_KEY` is already set in Vercel, so Tier 2 is unblocked whenever it's built — just not bundled into this PR.

**Built:**

- `app/api/gmail/route.js` — read-only Gmail proxy (list + get metadata only, per the hard read-only boundary in CLAUDE.md §7 — no write/modify/delete call exists anywhere in this codebase). Lists the 40 most recent inbox messages, parses the sender's domain out of the `From` header, and filters out any message whose sender domain matches an active Tier 1 rule — a plain DB lookup against `email_rules`, no AI.
- `app/api/email-rules/route.js` (GET/POST) and `app/api/email-rules/[id]/route.js` (DELETE) — Tier 1 rule CRUD. Clicking the "×" on an email in the UI parses the sender's domain from the header client already has and POSTs it as a new tier-1 rule; DELETE is the "undo" (unhides the sender going forward).
- `app/email/page.jsx` (+ `page.module.css`) — replaces the Coming Soon stub. Read-only inbox list (from/subject/snippet/date) with a hide button per row, plus a compact "Hidden senders" management strip (chips with an undo ×) above the list.

**Verified:** `next build` succeeds. `/api/gmail` confirmed degrading to `{"messages":[],"configured":false}` locally with no Google credentials. The `email_rules` insert/select/delete query shapes the routes use were verified directly against the real `personal-dashboard` Neon project via the Neon MCP. The actual Gmail API call itself (list + metadata fetch + domain filtering) is unverified end-to-end in this sandbox — same network limitation as every prior domain — but Calendar already proved the shared OAuth client works, and this route reuses it unchanged.

**Left for later:** Tier 2 (Haiku-evaluated content rules — "hide shipping-delay notices but keep delivery confirmations"), the first-run onboarding scan (frequency `GROUP BY`, one-time, tracked via `app_flags`), and Gmail-native category/search-operator use ("lean on `category:promotions` before reaching for a model"). All explicitly deferred by John's own scoping call this session, not an oversight.

---

## 2026-07-14 — AI Projects populated with real data + Vercel link fix

John asked to add real tracked projects to AI Projects. Looked up his actual Vercel projects and their linked GitHub repos (via the Vercel MCP) and inserted four rows directly against the `personal-dashboard` Neon project: **NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning** (all with GitHub + Vercel URLs), and **Agentic-Loop** (GitHub only — it's a protocol repo with no deployment, per CLAUDE.md). Deliberately excluded Personal Dashboard itself and a private `Projects-Dashboard` Vercel project that isn't one of the four sibling repos CLAUDE.md names — both were John's explicit call, not an oversight.

**Bug caught in review:** John asked why `VERCEL_API_TOKEN` was needed at all, and specifically whether it should only gate the Vercel-linked projects. Tracing through confirmed it already does — Agentic-Loop never calls the Vercel API regardless of the token, since it has no `vercel_url`. But that question surfaced a real gap: `ProjectCard` only rendered the "Live site" link when the Vercel API confirmed `status === 'READY'`, meaning _no_ link ever appeared for any project without the token configured, even though the URL was sitting right there in the DB. Fixed: the link now always renders whenever `vercel_url` exists, labeled "Live site" when status is confirmed `READY` and "Open" otherwise. The token is now purely an enhancement (adds the Ready/Building/Failed status pill) rather than a requirement for the basic link to show up — `VERCEL_API_TOKEN` provisioning is downgraded from blocking to optional in the to-do above.

**Verified:** `next build` succeeds. The four project rows were verified via the Neon MCP's `RETURNING` output on insert (not through the app's own API — Vercel's deployment protection blocked automated fetches this session, an intermittent issue also seen on the Email PR).

---

## 2026-07-14 — Email Tier 2 (Haiku semantic residual rules)

Built the second tier of Email's hide-rule system, on top of Tier 1 (PR #10). Per CLAUDE.md §7, Tier 2 is deliberately scoped to the residual Gmail's own categories can't express — e.g. "hide shipping-delay notices but keep delivery confirmations" from a sender you otherwise want. Not applied to Tier 1 senders, since those are already filtered out of the list before Tier 2 ever runs.

**Built:**

- `lib/email-tier2.js` — `shouldHideByRule(ruleText, subject, snippet)`, a single Haiku call (`claude-haiku-4-5`, already the pinned model in `lib/anthropic.js`) that answers HIDE or KEEP for one email against one rule. Defaults to KEEP on any error, missing key, or ambiguous response — a wrongly-kept email is recoverable by re-reading the inbox; a wrongly-hidden one is invisible, so the failure mode is deliberately asymmetric.
- `app/api/email-rules/route.js` — extended to handle both tiers. Tier 1 POSTs now dedupe (return the existing active rule instead of inserting a duplicate). Tier 2 POSTs enforce **one active rule per sender** — managing a sender again deactivates the prior rule and inserts the new one, rather than accumulating rules per sender. GET now returns both tiers for the management view.
- `app/api/gmail/route.js` — after Tier 1 filtering, remaining messages whose sender has an active Tier 2 rule get evaluated in parallel via `shouldHideByRule` against that sender's subject + snippet (not full body — kept cheap, and sufficient for the kind of judgment calls Tier 2 rules describe).
- `app/email/page.jsx` — added a "⚙ Manage" action per row (separate from Tier 1's "×") that opens an inline rule editor; existing Tier 2 senders show a small "Tier 2" tag. The rules management strip now shows Tier 1 (hidden senders) and Tier 2 (content rules, with their rule text) as two distinct groups, both with undo/delete.

**Verified:** `next build` succeeds. The Tier 2 insert/dedupe-replace query shapes verified directly against the real Neon project via the Neon MCP (insert, deactivate-prior, re-insert, confirm only one active row remains). The actual Haiku evaluation call and its effect on `/api/gmail`'s filtering is unverified end-to-end in this sandbox — no network path to Anthropic's API here either — but reuses the exact `getAnthropic()` client already scaffolded and pinned to Haiku.

**Left for later:** the first-run onboarding scan (frequency `GROUP BY` over recent senders, proposes Tier 1 candidates, one-time via `app_flags`) — a separate, non-AI feature, tracked above, not bundled into this PR.

---

## Template for future entries

```
## YYYY-MM-DD — Short title

What changed, what was decided, why. Link related commits/PRs if applicable.
```
