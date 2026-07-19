# Roadmap / Session Log

Dated history and session-by-session notes live here, not in `CLAUDE.md`. `CLAUDE.md` stays a living reference; this file is the narrative.

---

## Open / Tracked To-Dos

_(Not dated history — live items that outlast a single session. Check `[x]` the box the session a step is completed, noting the date; remove the line once it's no longer useful context.)_

- [x] **`## Next Up` retrofit across sibling repos** — 2026-07-15. Added a standardized `## Next Up` section to the top of each tracked repo's `ROADMAP.md`, each seeded from that repo's own current roadmap state (not invented) and placed so the dashboard's parser captures only the intended text (bounded by the next `## ` heading): NextGen-Scholars #218 (Play Store native rollout), NextGen-Immersion #110 (Phase 32 TWA→Play), AI-Capital-Planning #153 (post-migration hardening / no test suite), Agentic-Loop #1 (created a ROADMAP.md — it had none — Next Up = cut the first `v1.0` tag). All merged. AI Projects cards now show real "Next Up" lines. _(The Stack Blueprint isn't a tracked AI Projects repo, so it needs no `## Next Up` for parsing; propagating the convention there is a docs nicety, not done here.)_
- [x] **Build weekly Gmail trip auto-detection** — scoped then built 2026-07-15 (see entries below). Weekly Vercel Cron + manual "Scan Gmail" button → read-only Gmail search → Haiku detection → `trip_suggestions` (migration 003) → review banner + Home-card warning + bell notification → Approve (creates trip + auto-runs itinerary import) / Dismiss. **`CRON_SECRET` provisioned 2026-07-15** — cron GET is now protected.
- [x] Record exact Vercel project slugs/IDs and repo names to track in AI Projects — 2026-07-14. Added NextGen-Scholars, NextGen-Immersion, AI-Capital-Planning (all with their `-jonncy18.vercel.app` domains), and Agentic-Loop (GitHub only, no deployment). Deliberately left out Personal Dashboard itself and the private `Projects-Dashboard` repo (John's call — not one of the four sibling repos CLAUDE.md names).
- [x] Provision Google OAuth (`GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`) in Vercel — 2026-07-14. Verified end-to-end against both Calendar and Gmail (both scopes granted in one consent pass). Still blocks Travel's AI-assisted Gmail itinerary import (not built yet) and Email's Tier 2 + onboarding scan (not built yet — Tier 1 doesn't need it).
- [x] Provision `UNSPLASH_ACCESS_KEY` in Vercel — 2026-07-15. Surfaced (and fixed, see entry below) a PATCH retry bug that kept pre-key trips permanently stuck without a photo even after the key was added.
- [x] Build Email's Tier 2 (Haiku semantic residual rules) — 2026-07-14, see entry below. First-run onboarding scan is still deferred (separate feature, not bundled in).
- [x] Build Email's first-run onboarding scan (frequency `GROUP BY`, one-time, tracked via `app_flags`) — proposes likely Tier 1 candidates on first `/email` visit. Not AI, not blocked on anything. **2026-07-15, see entry below.**
- [x] Build the Schedules domain (was still a `ComingSoon` stub despite the `schedules` table existing since `001_initial.sql`) — **2026-07-15, see entry below.**
- [x] Build the Idea Board domain — **2026-07-16, see entry below.** Was still a `ComingSoon` stub despite the `ideas` table existing since `001_initial.sql`. Title/notes/status/domain-tag CRUD, no due date. Last of the six domains to be built out.
- [x] Wire Home/Sidebar/TopBar off `lib/mock-data.js` onto real per-domain data — **2026-07-15, see entry below.** `lib/mock-data.js` deleted. Email's home-card count is intentionally still `null` ("—"), documented as a deliberate scope cut, not a placeholder left behind.
- [x] **Language Gmail wiring** — John chose the weekly-auto-scan pattern (mirroring Travel's trip-suggestions). Built 2026-07-15, see entry below. Turned out to need **no AI** — see that entry for why.
- [x] **Fix: date-only fields showing the wrong relative day/weekday for negative-UTC-offset viewers (e.g. Eastern)** — 2026-07-15, see entry below. Real bug in every Schedules due_date / Travel start_date-end_date display.
- [x] **Fixed: `app/api/trip-scan/route.js`'s `matchesExistingTrip` date comparison** — 2026-07-16, see entry below. Was comparing `trips` rows' raw `start_date`/`end_date` (DB `Date` objects) against a candidate's plain `"YYYY-MM-DD"` strings with `<=`/`>=`; the `Date`-vs-string coercion went through `.toString()`, not the ISO form, so the overlap test silently always failed and real duplicate trips slipped through as new suggestions. Now both sides go through `dateOnly()` first.
- [x] **Add a migration runner** — 2026-07-16, see entry below. Surfaced by the Travel redesign (#29): its migration file merged and deployed cleanly, but the live Neon DB was never updated, so `/api/trips` 500'd until applied by hand. `npm run migrate` now closes that gap — explicit, not automatic (Preview and Production share one Neon database here, so build-time auto-migration was rejected — see the entry below and CLAUDE.md §6).
- [x] **Run `npm run migrate` after this merges** — 2026-07-19, applied via the Neon MCP right after merge. Migration 011 (`language_progress`) added `french_hours_daily`, `french_hours_summary`, `language_notes` to the live DB; confirmed all three exist and `schema_migrations` records the file.
- [ ] **Run `npm run migrate` after the To-do's + Calendar PR merges** — migration 012 (`email_todos`) adds the flagged-to-do table. Same one-shared-Neon-DB gotcha as always (CLAUDE.md §6): the Home hero's To-do's block and `/email`'s star toggle 500 against a DB without this table until it's applied.
- [ ] **Run `npm run migrate` after the Calendar-hide PR merges** — migration 013 (`calendar_hidden`) adds the per-event hide table. `/calendar`'s hide/Hidden-popup 500s against a DB without this table until it's applied.

---

## Design / UX Backlog

_(Raised 2026-07-16 by John. Layout/interaction polish across pages and cards — separate from the domain-build work, which is now complete. Items marked **needs scoping** get a grill session or a mockup from John before Build, per the project's scope-before-build convention; items marked **build-ready** are concrete enough to just do.)_

- [x] **AI Projects redesign** — 2026-07-16, see entry below. From John's ChatGPT mock, run through the honest-data pass: stat bar + featured panel + tabbed project list with a **hover detail popover** (holding the status setter) + a real recent-activity rail. Wired to real GitHub/Vercel data (description, language, topics, last commit, open issues, deploy status, milestone-based progress, merged activity feed); a thin manual layer (`status`, `featured` — migration 007) covers what GitHub can't know. Dropped the mock's fabricated progress numbers + "↑5% this week" trend.
- [x] **Idea Board quick-capture popup** — 2026-07-16, see entry below. Clicking the Home Idea Board card opens a popup: a free-write box (first line → title, rest → notes) + optional domain-tag chip on top, the existing ideas listed below with done-toggle / inline edit / delete. Scoping resolved with John: **keep** the `/ideas` route (popup is an additional quick surface; a cmd/ctrl-click on the card still opens the full page), **single free-write box**, **combined** write + list in one popup. Front-end only — `/api/ideas` unchanged.
- [x] **Richer card design — AI Projects, Language, Idea Board Home cards** — 2026-07-16, see entry below. Scoped with John first: **AI Projects** → per-project status-dot row; **Language** → countdown to next call + tutor/context line; **Idea Board** → open/done split + count-by-tag chips. All real-data, no new schema, front-end + one home-summary query change.
- [x] **TopBar greeting should not wrap** — 2026-07-16 (#28). `.greetingTitle` now `white-space: nowrap`.
- [x] **TopBar stat trio should stack vertically** — 2026-07-16 (#28). `.stats` is now a flex column.
- [x] **Home page redesign + time-of-day hero** — 2026-07-16, see entry below. Dark layout from a ChatGPT mock: a hero photo that changes with the local time of day (Unsplash, cached per band per day), greeting + daily rotating unattributed quote, real stat tiles, two-column Up Next / At-a-glance. Dropped the mock's fabricated "focus %" rings and sidebar weather (no data source).
- [x] **Travel page redesign** — 2026-07-16, see entry below. Iterated from a light card grid → dark cinematic layout (John's ChatGPT mock as the reference). Shipped the real-data core **plus** the Trip Map and AI Travel Brief: Next Journey hero, a soft-timeline "then coming up", a past gallery, a geocoded world map, and a cached honest AI brief. Grilled repeatedly against the project's no-fabricated-data rule; every panel is backed by real trip fields.
- [ ] **Travel Health panel** — _reserved, needs a new data model._ Passport expiry + per-trip booking/prep status (flights, hotel, insurance, excursions, packing) from the ChatGPT mock. None of this exists in the schema. Out until John wants to add the data model + entry UI. **Do not fabricate** these values.
- [ ] **Travel Stats bar** — _reserved, needs data / integration._ Countries visited + cruise nights are roughly derivable from trips; **points/miles imply a loyalty-account integration** and have no source today. Out until backed by real data — no invented totals.
- [x] **Wishlist trip status** — 2026-07-17, see entry below. Added `'wishlist'` to the `trips.status` CHECK (migration 009), widened the POST/PATCH validation, and gave it two set-points (a Status select on Add Trip + the existing detail-page Status select) and a Wishlist section on the Travel page. **Run `npm run migrate` after merge** before relying on the deployed code — same one-shared-Neon-DB gotcha as always (CLAUDE.md §6).

---

## Future Domain Ideas (unscoped)

_(Candidates for a future domain/card — not yet grilled. Do not build schema or UI for these until a scoping session resolves the open questions, per the project's own convention of scoping before Build.)_

- [ ] **Health & Fitness card/subsection.** Raised 2026-07-13, not yet scoped. Open questions for a future grill session: Is this a 7th full domain (own route, own table) or a card/section within an existing domain (e.g. Home)? What's the data source — manual entry, or an integration (Apple Health, a wearable API, etc.)? What's the minimal v1 slice, matching how Language and Email started as a single live card before expanding?

---

## 2026-07-19 (cont'd 2) — Calendar: per-event hide (local flag, Calendar stays read-only)

Follow-up to the /calendar view below. John wanted the ability to hide specific events from the dashboard's calendar view. Same reasoning as email_hidden and the To-do's flag: Google Calendar is read-only by hard rule (§2/§7), so this is a **local flag only** — a new `calendar_hidden` table (migration 013, keyed by the Google event id, with a title/start snapshot at hide time), never a write back to the real calendar. `/api/calendar-events` filters hidden ids server-side before returning its list (same shape as `/api/gmail` filtering Tier 1 senders). A hover-revealed `×` on each agenda row and grid chip hides an event (optimistic, reverts on a failed persist); a "Hidden (N)" popup in the header lists everything hidden with an Unhide action, mirroring Email's Rules popup. Recurring events are already expanded to per-occurrence ids by `singleEvents: true`, so hiding one occurrence doesn't hide the whole series. **Run `npm run migrate` after merge** (migration 013).

## 2026-07-19 (cont'd) — Hero "To-do's" (email-flagged) + a real Calendar view

John wanted a "To-do's" section in the Home hero alongside "Up next", sourced from email or calendar. Grilled the scope with him across two rounds:

- **Source = Email only, via an in-app flag.** Not a Gmail star — Gmail is read-only by hard rule (§2/§7), so the app can never write a star back. The `☆`/`★` toggle on each `/email` row writes to a new `email_todos` table (migration 012), keyed by `gmail_message_id`, **exactly the `email_hidden` pattern**. The email's subject/sender/snippet are **snapshotted** at flag time so the Home hero renders the list with **no live Gmail call** (same "never per page load" discipline as the trip photo / hero image / AI brief). `done_at` makes it dismissible (stamped, not deleted, so a to-do can be un-done); the hero shows only `done_at IS NULL`.
- **Home wiring.** `home-summary` gained a `todos` array — cheap because it's our own table, unlike the still-`null` email `important_count` that would need a mailbox call. The hero's right-hand overlay is now a two-block **stack**: `HeroAgenda` ("Up next", capped at hero + 2) over a new `HeroTodos` ("To-do's", up to 3, each with a check-to-complete that PATCHes done + fires the app-wide `refresh()`). Empty state points John to `/email` so the feature is discoverable.
- **Calendar view** — John noticed there was no actual calendar in the dashboard (Calendar was used narrowly, only for the next-tutor-call card). Added a real `/calendar` route: a month grid (6-week, prev/next/Today nav) + a "This month" agenda, off a new **read-only, fail-soft** `/api/calendar-events` window (§7 external-source shape; empty list on any error, never a broken page). All-day vs timed events are distinguished and keyed to the correct **local** day (no UTC off-by-one — same class of bug as the date-only fix on 2026-07-15). New `CalendarIcon` + Sidebar nav entry.

No fabricated data anywhere: to-do's are real flagged emails, calendar cells are real events. **Run `npm run migrate` after merge** (migration 012) before relying on the deployed To-do's/star code.

## 2026-07-19 — Language domain: French hours log (screenshot import) + Spanish note

First real build-out of Language beyond the live tutor-call card, scoped in chat with John first (per the project's scope-before-build convention). Starting point: John tracks Spanish and French through Dreaming Spanish / Dreaming French, but the two languages needed genuinely different shapes, not one generic "hours" stat forced onto both.

**Scoping, resolved with John:**

- Checked first whether Dreaming Spanish/French have a public API — confirmed no: the only third-party tools found (e.g. a Chrome extension importer) work by riding a logged-in browser session, not a stable server-to-server credential, so there's no fit for this app's server-side route pattern.
- **French** is the active learning project (early stage) — John wants to paste a screenshot of Dreaming French's progress page and have hours pulled from it. This is genuine extraction (an arbitrary chart image, not a fixed template), so it needs Haiku vision — same reasoning that already keeps Travel's itinerary import on Haiku rather than a deterministic parser. John's own cost-discipline instinct (avoid AI where it's not needed) was checked against this and it holds: there's no non-AI way to read numbers off an arbitrary screenshot reliably.
- **Spanish** is already C1 (heading to C2) and is ambient/daily — phone in Spanish, podcasts, music, periodic tutor calls. Not something with an hours metric to log (forcing one would be either meaningless or busywork); it gets an editable freeform note instead, no AI, no derived stat.
- Three concrete decisions from John: (1) French history as a **logged history** (dated rows, not a single overwritten snapshot) so progress/trend is visible over time; (2) Spanish's note is **editable in-app**, not hardcoded; (3) Home's Language card **does** show the French hours total alongside the existing tutor-call countdown.

**Built (migration 011, additive):**

- `french_hours_daily` (dated log, upserted by date — a re-imported overlapping screenshot just corrects those days) + `french_hours_summary` (singleton headline total, kept separate from `SUM(french_hours_daily)` since a screenshot rarely shows full history — summing would understate real progress) + `language_notes` (freeform per-language note; only Spanish uses it today).
- `lib/french-progress.js` — the app's fourth distinct AI use. Haiku (vision) reads a screenshot and returns `{totalHours, asOfDate, dailyEntries}`, instructed to leave a field null/empty rather than estimate/guess anything illegible — never invent a number.
- `app/api/french-progress` (GET, current summary + recent log), `.../import` (POST, Haiku parse — **fails soft**, an AI/external route per CLAUDE.md §7's error convention, nothing saved), `.../save` (POST, **route()-wrapped** mutation — only this ever writes to the DB, and only with what John confirmed). Same never-auto-save discipline as Travel's itinerary import: the client shows an editable preview (`ProgressPreview`) before anything persists.
- `app/api/language-notes` (GET all notes, PATCH upsert one by language).
- `app/language/page.jsx` — full rebuild: a French section (headline total, "Upload screenshot" → preview/edit → save, recent daily list) and a Spanish section (the existing tutor-call card + Gmail-scan banner, now with an editable note card). Both `useResource` consumers surface a real fetch error distinctly from "no data yet" (fixed during verification below — the first pass silently showed "No hours logged yet" on a fetch failure, which would have been dishonest in exactly the way this app's own data rules forbid).
- `app/api/home-summary` + `components/DomainGrid.jsx` — Home's Language card gains the French hours line next to the tutor countdown.
- CLAUDE.md §2/§5/§6/§7 updated: the new AI use documented alongside Travel Brief/itinerary import, the Language routes-table row rewritten to describe the French/Spanish split, and the "settled domains have tables" note updated (Language's core call-lookup still isn't a table, but this one slice now is).

**Verified:** `next build` clean; Prettier passes on all touched files. **Rendered the actual `/language` page headlessly (Chromium)** against a dev server with no live Neon (same sandbox limitation as every prior domain build) — first pass exposed the dishonest-error-state bug above; after the fix, the page correctly shows "Could not load French progress." / "Could not load note." rather than masking the failure as empty data. Not exercised against live Neon/Anthropic in this sandbox — first real run happens on the deployed preview once migration 011 is applied (**run `npm run migrate` after merge** — tracked above).

---

## 2026-07-17 (cont'd 2) — Travel prep checklists (reusable templates, applied per trip)

Scoped with John (Keep isn't reachable via any MCP here, so he pasted his 3 lists), then built. First item toward the reserved "Travel Health" idea, done as the honestly-buildable slice: reusable packing/prep checklists.

**Decisions (John's picks):** live as a **Checklists sub-section inside Travel** (not a new top-level domain); **reusable templates applied per trip** (not per-trip one-offs, not a trip-type auto-apply). His real lists have **sections** (Toiletries, Tech, Docs, Cruise-specific…), so an item is `{text, section}` — the same flat-with-group-label shape as itinerary legs.

**Data model (migration 010, additive).** `checklist_templates` (the master lists) + `trip_checklists` (a template applied to a trip; items copied to `{text, section, done}` at apply time, so editing a template never disturbs a past trip's checked state). A trip may hold more than one (Business + Vacation). `lib/checklists.js` owns normalization + progress. Applied to Neon via the MCP; **John's actual checklist content is seeded straight into the DB, never committed** (personal packing data stays out of the repo — the migration only creates the shape).

**API + UI.** CRUD at `/api/checklist-templates` (+ `[id]`) and `/api/trip-checklists` (+ `[id]`), all `route()`-wrapped. Travel page gained a **Checklists** manager (collapsible template editors, section-aware); trip detail gained a **Prep checklist** block — apply a template, tick items (optimistic), real done/total progress bar. Seeded his three lists: Philippines/Cruise (114 items, sectioned), Business Travel (51), Vacation Travel (59).

**Verified:** `next build` clean; Prettier passes.

---

## 2026-07-17 (cont'd) — Multi-stop Trip Map (per-stop pins, routes, hover labels)

Scoped with John, then built: the Trip Map moved from one dot per trip to a real, multi-stop map that handles cruises (many ports) and multi-leg journeys (Philippines → Taiwan → Japan cruise).

**Decisions (all John's picks):** flat ordered **stops with an optional one-level `leg` label** (over true recursive sub-trips — captures every mappable place + date without the recursion cost); **every located stop is its own dot**, connected in date order into that trip's route; **hover label = trip + stop + date** ("Panama Cruise — Cartagena · Oct 26").

**Data model — no migration.** `trips.itinerary` is already `jsonb`, so a stop just grew from `{date,title,notes}` to also carry `location`, `latitude`, `longitude`, `geocoded_for`, and `leg`. Old days stay valid (no location = not mapped). `lib/itinerary.js` (new) owns the stop shape, geocoding, and map serialization.

**Geocoding.** `lib/geocode.js` refactored: a shared Nominatim core now returns a **status** (`ok` / `none` / `error`) so a definitive no-match is told apart from a transient failure. `geocodeStops` caches coords per stop (keyed by `geocoded_for` so only changed locations re-resolve) and — the key robustness fix — **does not** cache on a transient error (429/5xx/network), so a rate-limit during a bulk backfill can't permanently unplace a real port; it retries next pass. Capped at 12 new lookups per pass; `/api/trips` PATCH geocodes on save and `/api/trip-map` backfills the remainder lazily (same discipline as the trip-level backfill), one-time per stop.

**Map + detail view.** `WorldMap` draws a dot per located stop, a dashed route per trip, and a styled hover tooltip (percentage-positioned so it tracks the dot at any size; keyboard-focusable with an SVG `<title>` fallback). The trip detail editor gained **Location** (maps the stop) and **Leg** (optional group) fields per stop, renders leg-group headers, and renumbered "day" → "stop". The Gmail/Haiku import now also extracts each stop's `location` and `leg` (shown in the preview), so importing a cruise confirmation places its ports automatically.

**Verified:** `next build` clean, Prettier passes; stop normalization / mappable-filter / numeric coercion / geocode-need logic unit-checked. Interactive hover + live geocoding verify on the Vercel preview (no local Neon here).

---

## 2026-07-17 — Refresh-button coverage + Wishlist trip status

Two next-step items off the roadmap (plus one config note).

**Refresh-button coverage gap closed.** Travel, Email, Ideas, and Schedules still hand-rolled their own `fetch`, so the TopBar refresh button (which drives `refreshKey` through `useResource`/`useHomeSummary`) didn't reach them. Migrated all four onto `useResource`, so the button now covers every page. Pages with optimistic mutations keep their local state: the hook's `data` is mirrored into local state via an effect, and the hook's `reload()` replaces the old imperative reloads after a mutation (Email's `loadMessages`/`loadRules`, Travel's `loadSuggestions`, the scan/approve/dismiss refresh). No API changes — front-end only. CLAUDE.md §7's "not wired yet" note updated to reflect full coverage.

**Wishlist trip status.** The Trip Collection's third status from the Travel mock. Added `'wishlist'` to the `trips.status` CHECK (**migration 009** — idempotent drop/re-add of the auto-named constraint; `schema.sql` CHECK + Applied-migrations line bumped). Widened POST/PATCH validation in `/api/trips` + `/api/trips/[id]` to accept it. Two set-points: a **Status select on the Add Trip form** (Upcoming / Wishlist — Past stays a lifecycle transition via edit) and the **existing detail-page Status select** (gained a Wishlist option). Travel page renders a new **Wishlist section** (`WishlistCard` — dates optional, so no countdown/length chrome; shows budget if set). A wishlist trip is excluded from the upcoming/past logic (hero, timeline, map), same as it should be. **Reminder: run `npm run migrate` after this merges** — Preview + Production share one Neon DB, so the CHECK widening must be applied by hand before the deployed code writes a wishlist row (CLAUDE.md §6).

**Vercel token read-only scope (to-do removed).** Checked Vercel's current docs: a personal (Hobby) access token has **no read/write toggle** — it inherits the full-access scope of the account it's created under. Read-only is only achievable via a **Team** token acting under a **Viewer**-role member, which doesn't apply to a solo Hobby account. John's call (2026-07-17): the token is server-only and the app link is private/unshared, so the residual risk is accepted — dropped the to-do rather than chase a setting that doesn't exist. Mitigation if ever wanted: keep it server-only (already the rule), short expiration, rotate.

Verified: `next build` clean, Prettier passes on all touched files.

---

## 2026-07-16 (cont'd 9) — Manual refresh button + PWA wrap (installable app)

Two asks from John: a navbar refresh button "for when there are any updates", and wrapping the app as an installable PWA (he brought ChatGPT-mocked icon concepts).

**Refresh button + global refresh signal.** New `lib/refresh.jsx` — a `RefreshProvider` (wraps the shell in `AppShell`) exposing `{ refreshKey, refreshing, refresh, settle }`. The TopBar button calls `refresh()`, which bumps `refreshKey`; every subscribing data hook re-fetches. Wired: `useHomeSummary` (invalidates its module-scope cache once per new key so the three consumers still share one round trip, then `settle()`s the spinner when the refetch resolves) and `useResource` (adds `refreshKey` to its effect deps). The button spins (`aria-busy`, reduced-motion-safe) while in flight, with a 5s safety timeout so it can never stick. **Coverage note:** this refreshes everything reading through those two hooks (Home + Sidebar + TopBar summary, and any `useResource` page — currently the Language card). Pages that still hand-roll their own fetch (Travel, Email, Ideas, Schedules) aren't wired yet — migrating them onto `useResource` is the clean follow-up that makes the button universal.

**PWA.** `app/manifest.js` (Next metadata route → `/manifest.webmanifest`, auto-linked): standalone display, `#0b1220` theme/splash, the three icons. `public/sw.js` — a conservative service worker: cache-first for hashed static assets, network-first for pages (offline fallback to the cached shell), and **API routes never cached** (freshness matters, and the refresh button assumes live reads). Registered via `components/RegisterSW.jsx` (production only — a dev SW just fights HMR). `layout.jsx` gained theme-aware `theme-color`, `appleWebApp` meta, and the apple-touch-icon.

**Icon — chose "Horizon" (concept 01).** Recommended it over the other seven: it matches the app's actual identity (the time-of-day hero, the "Good morning / Still up" greeting, the daily fresh-start feel), and a single bright point over a horizon stays legible at 48px where the compass/sailboat/quadrant marks turn to mush — which is why John's own mock previewed Horizon in the PWA-size row. Generated as an SVG in the app palette (navy `#0b1220` gradient, `#6d93ff` accent star) and rasterized (headless Chromium) to `public/icons/` — `icon-192`, `icon-512`, `icon-maskable-512` (full-bleed for the safe zone), `apple-touch-icon` (180), and `app/icon.png` (favicon). One swappable asset set, so switching to "Journey" (the runner-up) later is cheap.

**Verified:** `next build` clean; Prettier passes. Production server checked: `/manifest.webmanifest`, `/sw.js` (with a `fetch` handler — the installability requirement), and all icons serve 200; head carries the manifest + apple-touch-icon + per-scheme theme-color links. Drove the refresh button headlessly — clicking it re-fetches `/api/home-summary`, spins the icon + sets `aria-busy` while a (delayed) refresh is in flight, and settles both when the data returns. Icons eyeballed at 512 + maskable.

---

## 2026-07-16 (cont'd 7) — Richer Home domain cards (AI Projects / Language / Idea Board)

First item off the Design/UX backlog after the design-review cleanup (#35) merged. The three cards read sparse next to Travel/Schedules; scoped with John what each should surface, holding to the no-fabricated-data rule (every value traces to a real source).

**Scoped decisions:**

- **AI Projects** → a **status-dot row**: one dot per tracked project, colored by lifecycle status (`PROJECT_STATUS_META`). DB-only, no external GitHub/Vercel call on the Home load (deploy-state dots were an option but rejected here to keep Home cheap — that lives on the `/ai-projects` page).
- **Language** → **countdown to next call** (`relativeDay` — "In 3 days") as the headline, plus the **tutor/context line** (the real event title, truncated; italki bookings read "Spanish lesson with …", Calendar matches show their actual summary — not a parsed-out name, which those inconsistent titles can't give honestly).
- **Idea Board** → **open/done split** ("6 open · 3 done") + **count-by-tag chips** (a `GROUP BY`-equivalent over `domain_tag`, top 4).

**Built:**

- `app/api/home-summary/route.js` — projects query now returns `statuses[]` (not just a count); ideas query returns `domain_tag, status` for every idea, aggregated in JS into `open_count` / `done_count` / `by_tag` (set is tiny). One extra column each, no new query round trips.
- `lib/projects.js` — hoisted `PROJECT_STATUS_META` (label + color per status) here so the Home dots and the AI Projects page share one source; the page now imports it instead of its own copy.
- `components/DomainGrid.jsx` + `.module.css` — `StatusDots` (capped at 10 + "+N"), the Language countdown/context block, and `IdeaTagChips`. The Idea Board card's open count stays live off the popup's `onCountChange`; the done-count and tag chips refresh on the next Home load (acceptable minor staleness for a glance card).

**Note:** the Email card was deliberately left sparse — still no honest count without a live Gmail call on every Home load (unchanged from before, CLAUDE.md §7).

**Follow-on (same PR) — diagonal hue treatment.** John then asked for a subtle diagonal color wash on the cards + page background. Mocked two intensities × both themes in an artifact first; he picked "Option B (Lift)". Each of the five non-photo cards (`cardProjects/cardSchedules/cardLanguage/cardIdeas/cardEmail`) gets a `::before` painting a tint of its own domain hue in the top-left corner and a neighbouring hue in the bottom-right (indigo→cyan, amber→coral, emerald→lime, yellow→gold, violet→magenta), fading to the plain surface through the middle. Strength is a theme token `--card-hue-alpha` (0.14 light / 0.26 dark). **Travel is excluded** — it already carries the trip photo. The page background (`html`) gets the same idea desaturated (`--bg-grad`: cool blue → soft lavender / navy → plum), fixed to the viewport. Verified by rendering the real page headlessly in both themes.

**Verified:** `next build` clean; Prettier passes. **Rendered the real Home page headlessly (Chromium) against a mocked `/api/home-summary`, in both light and dark** — the status dots (all six status colors), the "In 3 days" countdown + truncated tutor line, and the "6 open · 3 done" + Travel/AI/General tag chips all lay out correctly in both themes. Live Neon not exercised in the sandbox (no `DATABASE_URL`, proxy blocks outbound) — but this adds no migration, so there's nothing to apply: the new fields are derived from existing columns and surface on the deployed preview immediately.

---

## 2026-07-16 (cont'd 6) — AI Projects redesign (GitHub/Vercel-derived + thin manual layer)

John brought a ChatGPT mock and wanted to stay close to it, plus explore a hover-to-detail popover. Same honest-data pass as Travel/Home: mapped every panel to a real source, flagged the fabricated bits, and got three decisions — **manual status** (per project), **milestone-based progress** (from GitHub), **topics+language** for badges — then built.

**What's real (the bulk of it):** repo description, language, **topics** (tech/category badges), **last commit** + relative time, open issues, deploy status (Vercel), a **Recent Activity feed** (commits + deploys merged, newest first), and **progress from a repo's open GitHub milestone** (closed ÷ total issues — shown only where a milestone exists; no milestone → no bar, stated honestly). **Dropped as fabricated:** the mock's specific progress numbers and the "↑ 5% this week" trend (no history).

**Manual layer:** `projects.status` (planning / active / needs_attention / on_hold / blocked / completed — drives the tabs + the stat-bar counts) and `projects.featured` (at most one; the featured panel) from migration 007, plus `projects.category` (a manual label — Mission / Personal / Infrastructure / Client / Learning; free text, migration 008) added after John flagged that the auto-detected language ("JavaScript") is a useless card label when every repo is JS. All three edited in the row's hover popover.

**Card design (John reviewed the preview, picked design "B"):** the project list stays a tight single list, with a **status-colored left accent** per row, a **tech chip** (real language/topic), and a **live deploy dot** (green Live / amber Building / red Failed, from Vercel). Chosen from three mocked variants.

**Built:**

- `lib/github.js` — shared server helpers (repo meta, recent commits, open milestone → %, Next Up), optional `GITHUB_TOKEN` (60→5000 req/hr + private repos), all cached (`revalidate: 600`) and fail-soft. `lib/vercel.js` — factored the deploy lookup out of the route so `/api/projects/overview` and the existing `/api/vercel` share it.
- `app/api/projects/overview/route.js` — one server call: every project's DB row enriched with GitHub + Vercel data + a merged activity feed. One round trip for the client, one place for GitHub caching/rate-limits.
- `app/api/projects` (GET/POST now include status/featured) + new `app/api/projects/[id]` (PATCH status/featured — featured is exclusive; DELETE).
- `app/ai-projects/page.jsx` + `page.module.css` — full redesign: header + tagline, stat bar, featured panel, tabs, project list with the **hover popover** (description, last commit, milestone, issues, Next Up, links, **status dropdown + Feature toggle** — the popover is a DOM child of the row, so hovering it keeps it open and its controls usable), and the activity rail.
- `neon/migrations/007_project_meta.sql` + `schema.sql`; CLAUDE.md §2/§4/§7 (GitHub token optional, the AI-Projects data rule).

**Verified:** `next build` clean; Prettier passes. Stat-bar math + activity-merge exercised in Node (in-flight/need-attention/blocked counts, avg-across-milestones, newest-first sort). **Rendered the real page module CSS headlessly (Chromium) with a popover forced open** — stat bar, featured panel, tabbed list, the popover (incl. the status editor), and the activity rail all lay out correctly. Live GitHub/Vercel/Neon not exercised in the sandbox (no creds; proxy blocks outbound) — the enrichment + activity feed first run on the deployed preview once migration 007 is applied to the shared Neon DB (via the Neon MCP, same as prior migrations).

---

## 2026-07-16 (cont'd 5) — Idea Board quick-capture popup

First item picked back up off the Design/UX backlog. Scoped the three open questions with John first (keep `/ideas` vs replace / free-write vs structured / combined vs two-action), landing on: keep the route, single free-write box, combined write+list popup.

**Built:**

- `components/IdeaBoardPopup.jsx` (+ `.module.css`) — a modal opened from the Home Idea Board card. Free-write textarea on top (`parseFreeWrite`: first non-empty line → `title`, the rest → `notes` — fits the existing schema, and ideas still have no due date per CLAUDE.md §7) with an optional domain-tag chip row and Cmd/Ctrl+Enter to submit. Below it, the existing ideas with a done-toggle, inline edit (the row becomes a free-write textarea seeded from `title`+`notes`), and delete. All CRUD hits the unchanged `/api/ideas` + `/api/ideas/[id]`. Escape and backdrop-click close it.
- `components/DomainGrid.jsx` — now a client component; the Idea Board card's normal click opens the popup (`preventDefault`), while a modified click (cmd/ctrl/shift/middle) still follows the `href` to the full `/ideas` page. The card's idea count is lifted into state and updated live from the popup (`onCountChange`), so adding/removing an idea reflects immediately without a Home reload.

**Verified:** `next build` clean; Prettier passes. Rendered the real popup module CSS headlessly (Chromium) — free-write box + tag chips + the list with per-domain tag colors, the done row struck through, edit/delete affordances all correct. Not exercised against live Neon in the sandbox (no `DATABASE_URL`) — but the CRUD endpoints are the same ones the `/ideas` page already uses, verified earlier; only the front-end interaction is new. The `parseFreeWrite` split (first line title / remainder notes, leading blanks trimmed) is straightforward and covered by the write + inline-edit paths.

---

## 2026-07-16 (cont'd 4) — Home redesign: time-of-day hero + honest stat tiles

John shared a ChatGPT re-mock of the Home page and asked specifically for "the picture up top to change depending on the time of day." Same playbook as the Travel redesign: grilled the mock against the no-fabricated-data rule first, previewed the honest version in a visual artifact (with a Dawn/Day/Golden/Night switcher so he could see the hero change), then built.

**Kept from the mock, all real:** the greeting + status line, the Up Next agenda, the At-a-glance domain cards — re-laid into a hero + stat-bar + two-column layout. **Dropped as fabricated:** the "72% Daily focus" ring, the Language card's "68%" ring, any per-card progress ring (no data source — same reason the Language "weekly goal" ring was deleted earlier), and the sidebar weather (a new external, out of scope). Also flagged the mock's "John Shaw · Idea Board" agenda row as impossible — Idea Board items have no dates, so nothing undated can appear in a dated agenda.

**Built:**

- **Time-of-day hero** (`components/HomeHero.jsx` + `.module.css`): the client picks a band from its own clock (`lib/time-of-day.js` — Dawn 5–8 / Day 8–17 / Golden 17–20 / Night 20–5, John's ranges) and calls `/api/hero-image?band=…`. That route caches one Unsplash photo per band per calendar day in the new `hero_image` table (migration 006) — a page load never hits Unsplash unless the band hasn't been fetched yet today, same rule as the trip photo. `lib/unsplash.js` gained `fetchScenicPhoto(query)` (curated query, landscape). No key / no result falls back to a per-band CSS gradient (four hand-tuned skies), never a broken image. Greeting via the existing `timeOfDayGreeting`; quote from `lib/quotes.js` — a generic, **unattributed** line rotating once a day (John's call: no personal byline).
- **`components/TopBar.jsx`**: now route-aware (`usePathname`) — on Home it slims to just navigation + actions, since the hero carries the greeting; unchanged on every other page.
- **`app/page.jsx` + `page.module.css`**: hero → real stat bar (Need attention / Email flagged / Events today, no focus ring) → two-column Up Next + At-a-glance (both existing components, unchanged).

**Verified:** `next build` clean; Prettier passes. Time-band boundaries checked in Node at every transition hour (04→night, 05→dawn, 08→day, 17→golden, 20→night, 00→night — all correct); quote rotation confirmed stable-within-a-day, rotating-across-days, never empty, and byline-free. **Rendered the actual shipped `HomeHero`/`page` module CSS headlessly (Chromium)** — the golden-hour hero (greeting + status + quote + credit), stat bar, and two-column layout all lay out correctly; the gradient fallback (shown without a live photo) stands on its own. Not exercised against live Unsplash/Neon in the sandbox (no key/DB, and the proxy blocks outbound) — the hero photo's first real fetch happens on the deployed preview once `hero_image` exists (migration 006 applied to the shared Neon DB via the Neon MCP, same as 005).

---

## 2026-07-16 (cont'd 3) — Added a migration runner (`npm run migrate`), explicit not automatic

The Travel redesign (#29) exposed a real process gap: `neon/migrations/005_travel_map_brief.sql` merged and Vercel deployed the new code, but nothing had ever run that SQL against the live Neon database — `/api/trips` started selecting `latitude`/`longitude` columns that didn't exist and 500'd ("Could not load trips.") until John caught it on the preview and I applied the migration by hand via the Neon MCP. Every migration before this one had either predated real usage or been applied proactively in the same session, so the gap never bit — but it was always there.

**Design decision — explicit script, not build-time automatic.** The obvious fix in most stacks is "run migrations as part of the build." Checked first: this project's Preview and Production deployments share **one** Neon database (confirmed applying migration 005 directly — there's no per-branch DB here). That makes build-time auto-migration actively dangerous: a preview build for an unmerged, unreviewed PR would apply its schema change to the live database before anyone looked at the diff. Asked John explicitly; chose an explicit script over automatic-on-build.

**Built:**

- `scripts/migrate.js` — a plain Node script (no framework, per CLAUDE.md §6's existing "no ORM" stance), run via `npm run migrate`. Creates `schema_migrations` (filename PK + applied_at) on first use, reads `neon/migrations/*.sql` in filename order, and applies any not yet recorded. Since the Neon serverless driver only accepts one statement per call (hit this directly applying migration 005 by hand: "cannot insert multiple commands into a prepared statement"), it includes a small statement splitter (`splitStatements`, exported for testing) that respects `'...'` string literals and `$tag$...$tag$` dollar-quoted function bodies (the `set_updated_at()` trigger function in `001_initial.sql` has semicolons inside its `$$...$$` body that must not be split on) — a real SQL parser would be overkill; this handles exactly what this project's migrations actually contain.
- `package.json` — added the `migrate` script.
- `neon/schema.sql` — documented `schema_migrations` itself (maintained by the runner, not a numbered migration) and pointed the "run on a fresh project" note at `npm run migrate`.
- `CLAUDE.md` §6 — rewritten to describe the runner, and a new rule stating plainly why it's not build-wired, with this incident as the concrete example.

**Bootstrapped the live database** (with John's go-ahead, via Neon MCP — this sandbox's network proxy blocks both Nominatim, discovered earlier, and Neon's API host, discovered here, so `npm run migrate` itself couldn't be run live from this session): created `schema_migrations` and recorded migrations 001–005 as already applied, matching reality, so the next real run only picks up genuinely new migrations instead of harmlessly (idempotently) redoing five it doesn't need to.

**Verified:** the statement splitter was checked against all 5 real migration files — every `CREATE`/`ALTER`/`DROP` statement present exactly once, the one `$$...$$` function body preserved as a single statement (not fragmented by its internal semicolons), and every file's statement count matches its DDL-keyword count exactly (no orphaned comment-only statements). `next build`-equivalent isn't applicable (this is a standalone script); confirmed it doesn't run as a side effect of being imported (guarded behind a direct-execution check) so it's safely testable. The live `npm run migrate` execution path itself (talking to Neon over HTTPS from a real environment) was **not** exercised in this sandbox — proven unreachable here, works from Vercel/local dev where the earlier `DATABASE_URL`-backed features already function.

---

## 2026-07-16 (cont'd 2) — Travel redesign: dark layout + geocoded Trip Map + honest AI Brief

John: "this page just doesn't speak to me." Grilled the direction across several visual-artifact iterations (each run through a published mockup before any app code — his standing rule), landing on a dark, cinematic layout modeled on a ChatGPT mock he shared. The mock showed a lot of panels backed by data the app doesn't have (flight status, passport/insurance, points/miles, an AI brief citing live excursion/season facts). Held the line on the project's no-fabricated-data rule (same discipline that deleted the Language "weekly goal" ring and keeps Email's count at "—"): built only what's backed by real trip fields, and told John plainly which panels were fiction in the mock.

**Built (all real data):**

- **`app/travel/page.jsx` + `page.module.css`** — full redesign. **Next Journey hero** (soonest upcoming trip: photo, countdown, length, budget, days-planned), a soft-timeline **"then coming up"** (dotted spine, per-trip countdowns, `≈ N weeks/months later` gap markers between cards), and a **past gallery**. Blue accent (John's pick, matching the mock) over the app's shared tokens, so it themes light/dark like everything else. All existing behavior preserved (Add Trip, Scan Gmail, suggestions banner). Card signals (length, itinerary-planned, budget) are derived from real fields — trip length from dates, "N days planned" from the `itinerary` jsonb length.
- **Trip Map** — `components/WorldMap.jsx` (+ `.module.css`) renders a static, precomputed world map (`components/world-land-path.js`, generated from **public-domain Natural Earth 110m land**, projected equirectangularly into a 1000×500 viewBox) with a pin per trip and a dashed route through the upcoming ones in date order. No paid tile provider. Coordinates come from **`lib/geocode.js`** (OpenStreetMap Nominatim, no key, descriptive User-Agent) wired into trip create/edit (`app/api/trips` POST + `[id]` PATCH) — one lookup per trip change, cached on new `trips.latitude`/`longitude`; **`app/api/trip-map/route.js`** lazily backfills any trip missing coords exactly once (`geocoded_at` guards against per-load retries).
- **AI Travel Brief** — `lib/travel-brief.js` + `app/api/travel-brief/route.js`. Haiku writes a 2–4 sentence summary grounded **strictly** in real trip facts (countdowns, length, budget-set, itinerary-planned); the prompt forbids inventing flights/prices/weather/seasons. **Cached** in the new `travel_brief` table keyed by a signature (hash of trip facts + the calendar day) so a page load never calls the model unless something changed; regenerates at most daily to keep countdowns honest. New AI use beyond CLAUDE.md §7's Email + itinerary scope — expanded on purpose, documented in §7.
- **Schema** — `neon/migrations/005_travel_map_brief.sql` (+ `schema.sql`): `trips.latitude/longitude/geocoded_at` and the `travel_brief` cache table.
- **CLAUDE.md §7** — three new rules (map/geocoding, AI Brief grounding+caching, no map-tile provider).

**Deliberately NOT built** (would be fabricated — tracked as reserved above): Travel Health (passport/booking status), the Travel Stats bar (points/miles need loyalty integration), and the Wishlist tab (needs a `trips.status` migration).

**Verified:** `next build` clean; Prettier passes; all new routes registered. Pure logic exercised directly in Node — brief facts (upcoming-only, soonest-first, correct 7/29/110-day countdowns, budget-set flag) and its signature (stable, changes on a trip edit, changes across a day boundary); the date/length/gap helpers; and the map projection. **Rendered the actual `WorldMap` land path + real geocoded pins headlessly (Chromium)** and confirmed recognizable continents with every pin on the right landmass (Denver interior US, Morehead East Coast, Panama isthmus, Cebu in the Philippines; Tokyo/Lisbon greyed as past). Not exercised against live Neon / Nominatim / Haiku in this sandbox — no `DATABASE_URL`/`ANTHROPIC_API_KEY`, and the agent proxy blocks Nominatim (works on Vercel). Regenerate the map asset from a higher-res Natural Earth file if ever needed (the projection is a one-liner in the generator, noted at the top of `world-land-path.js`).

---

## 2026-07-16 (cont'd) — Fix: trip-scan dedupe never matched when both sides had dates

Closed the known-gap tracked since the date-timezone fix (2026-07-15 cont'd 9). `matchesExistingTrip` in `app/api/trip-scan/route.js` decides whether a Haiku-detected candidate trip is already covered by an existing trip (shared place-word AND overlapping dates) so it isn't re-suggested. The date-overlap half was silently broken.

**Root cause — the same `Date`-vs-string trap the display bug had, in a non-display path.** The existing `trips` rows are selected straight from Neon, so `t.start_date`/`t.end_date` are JS `Date` objects (DATE columns at UTC midnight). The candidate's `start_date`/`end_date` are plain `"YYYY-MM-DD"` strings from `detectTripFromEmail`. The overlap test `cs <= te && ts <= ce` therefore compared a string against a `Date`: JS coerces the `Date` via `.toString()` → `"Thu Jul 16 2026 00:00:00 GMT…"`, not its ISO form, and compares lexicographically. `"2026-…"` always sorts before `"Thu …"` (`'2'` < `'T'`), so `cs <= te` was always true and `ts <= ce` always false — the AND was **always false**. Net effect: whenever a candidate and an existing trip both had dates, the overlap check never fired, so a genuine duplicate was never deduped and got re-surfaced as a fresh suggestion for John to dismiss.

**Fix.** Route all four dates through `dateOnly()` (the helper added in the display-bug fix) before comparing, so both sides are bare `"YYYY-MM-DD"` strings — which sort lexicographically identically to calendar order. One import + four coercions in the one function; no schema, API-shape, or behavior change anywhere else. The candidate strings pass through `dateOnly` unchanged (idempotent); only the trip `Date`s are actually converted.

**Verified:** reproduced the exact bug in Node with the real type mismatch (existing trip as `Date` objects Jul 15–20, candidate as strings) — pre-fix, a plainly overlapping Jul 16–18 candidate returned `false` (missed dedupe); post-fix it returns `true`, and a non-overlapping Aug 10–12 candidate correctly returns `false`. `next build` clean; Prettier passes. Not exercised end-to-end through a live Gmail scan in this sandbox (no credentials here) — but the defect and fix are pure date-comparison logic, fully covered by the direct reproduction.

---

## 2026-07-16 — Built the Idea Board domain (last of the six domains)

Picked as the tracked next slice: `/ideas` was still the `ComingSoon` stub despite the `ideas` table existing since `001_initial.sql` — the identical gap Schedules closed a session earlier. This closes it, so all six domains now have real UI + routes.

Built to the CLAUDE.md §5/§7 spec: title, notes, status (`open`/`in_progress`/`done`), domain tag (`ai_projects`/`travel`/`schedules`/`language`/`general`). **No due date** — that's the deliberate boundary that keeps Idea Board distinct from Schedules (§7: "the boundary is the due date, not topic"). **No promotion path to AI Projects** either, per §5 — an idea is a someday/maybe record, full stop.

**Built:**

- `app/api/ideas/route.js` (GET list, ordered done-last then newest-first — POST create) and `app/api/ideas/[id]/route.js` (PATCH/DELETE), mirroring the CRUD shape of `/api/schedules` minus every due-date concern (no `dateOnly` boundary coercion needed — `ideas` has no date column). `status` and `domain_tag` are both validated against allow-lists at the route boundary, matching the table's CHECK constraints.
- `app/ideas/page.jsx` (+ `page.module.css`) — replaces the stub. Same checkbox-style list + inline add-form pattern as Schedules, but with a domain-tag chip (colored off each domain's own accent token) in place of Schedules' due-date chip and trip/project link badge. No date UI anywhere.

**Reused, not rebuilt:** the Home Idea Board card was already wired to a real count — `app/api/home-summary/route.js` has queried `COUNT(*) FROM ideas WHERE status != 'done'` since the mock-data teardown (2026-07-15 cont'd 7), and `DomainGrid` already rendered it. No Home change was needed.

**Verified:** `next build` clean (`/ideas`, `/api/ideas`, `/api/ideas/[id]` all registered); Prettier passes. Not exercised against live Neon in this sandbox (no `DATABASE_URL` here) — same limitation noted on every prior domain build; the query shapes mirror `/api/schedules`, itself modeled on the Neon-MCP-verified `/api/trips`.

---

## 2026-07-15 (cont'd 9) — Fix: date-only fields showed the wrong day for anyone west of UTC

John noticed the Morehead trip's "Up Next" card said "Tomorrow" when the trip is actually Thursday and tomorrow (from where he sat, Eastern) is Wednesday — a real off-by-one, not a misunderstanding.

**Root cause.** Postgres `DATE` columns (Travel `start_date`/`end_date`, Schedules `due_date`) come back from the Neon driver as a JS `Date` fixed at UTC midnight for the stored calendar day. Left as-is, `Response.json()` serializes "July 16" as `"2026-07-16T00:00:00.000Z"`. In Eastern time (UTC-4/5), that UTC instant is actually **8-9pm the evening before** — so any client-side code that re-localizes it (`new Date(that string)` + `.setHours(0,0,0,0)`, which `lib/format.js`'s `relativeDay`/`absoluteDate`/`daysUntil` all did) silently rolls the calendar day back by one for any negative UTC offset — i.e. all of the continental US. Reproduced directly: with the pre-fix code, in `America/New_York`, a stored `2026-07-16` rendered as **"Today"** instead of "Tomorrow" for a same-day "now" — an even more visible case of the same bug John spotted.

**Fix — two layers, same "coerce at the API boundary" pattern CLAUDE.md §7 already establishes for `num()`:**

- `lib/db.js` — new `dateOnly(value)`: converts a DATE column's `Date`/string value to a bare `"YYYY-MM-DD"` string. Applied at the boundary in every route that returns `trips.start_date/end_date`, `schedules.due_date`, or `trip_suggestions.start_date/end_date` (`app/api/trips`, `app/api/trips/[id]`, `app/api/schedules`, `app/api/schedules/[id]`, `app/api/home-summary`, `app/api/trip-suggestions`, `app/api/trip-suggestions/[id]`).
- `lib/format.js` — new (exported) `parseDateInput()`: a bare `"YYYY-MM-DD"` is parsed from its Y-M-D components directly into **local** midnight, never through the UTC-then-relocalize path. A full timestamp (e.g. a Language tutor call, which carries a real moment in time and _should_ convert across zones) still goes through ordinary `new Date()` parsing unchanged. `startOfDay`, `absoluteDate`, `absoluteDateTime`, `monthLabel`, `relativeDay`, `daysUntil` all route through this now. `lib/agenda.js`'s own date-vs-timestamp sort key had the identical bug (a bare-date regex check that could never actually match before this fix, since the API was emitting `"...T00:00:00.000Z"` — now it does) and now uses the same shared parser.

**Verified:** reproduced the bug and confirmed the fix directly in Node with `TZ=America/New_York` — pre-fix, `relativeDay('2026-07-16T00:00:00.000Z', <Jul-15-9am-local>)` returned `"Today"`; post-fix, `relativeDay('2026-07-16', <same now>)` returns `"Tomorrow"` and `absoluteDate('2026-07-16')` returns `"Thu, Jul 16"` — correct on both counts. `next build` clean, Prettier passes.

**Left as a known gap, not fixed here** (see tracked to-do above): `trip-scan`'s existing-trip dedupe compares raw DB `Date` objects against plain-string candidate dates with `<=`/`>=`, which isn't guaranteed correct — it's an internal heuristic, not a display bug, so out of scope for this pass, but worth a follow-up.

---

## 2026-07-15 (cont'd 8) — Language's Gmail wiring: weekly italki-scan, deliberately no AI

John asked for Language to get "the same Gmail wiring as Travel." Travel has two distinct Gmail patterns; asked which one — John chose the weekly auto-scan → suggestion → approve/dismiss pattern (mirroring `trip_suggestions`), not the one-shot manual import.

**Re-grilled "does AI belong here?" before building — same discipline as the original Travel-import scoping (2026-07-15 cont'd entry below) — and this time the answer for extraction is different.** Searched John's real Gmail (Gmail MCP, read-only) to find the actual pain point instead of guessing: of the three tutors, two (Nicolas, Bruno) already flow through Calendar directly — Nicolas's scheduling-tool booking emails and Bruno's Calendar invite both already produce real Calendar events, which the existing keyword/host match already finds (that's the whole history of the four Calendar-match fixes earlier this file). The actual gap is only italki (Daniel Bermúdez): italki lessons happen in italki's own in-app classroom and never create a Calendar event on their own — John has had to manually "Add to calendar" from the confirmation email before.

Pulled and read real italki "Your lesson request has been accepted by \<teacher>" emails. Every one is the **same fixed template from the same sender** with a labeled `Lesson Date/Time: Wednesday, 01 Jul 2026 10:00AM (UTC -04:00)` line. Unlike Travel's itinerary emails (heterogeneous providers — cruise HTML tables, airline text, hotel prose — genuinely needing Haiku to generalize across them), this is one homogeneous template: a regex parse is exact, not a heuristic. Verified the parse against two real emails by checking the extracted UTC instant against italki's own embedded "Add to calendar" link timestamp in the same email — both matched exactly. So: **deterministic search, deterministic parse, no AI at all** — the same reasoning CLAUDE.md §7 already applies to Email Tier 1's sender-header parse, just newly applied here.

**Built:**

- `neon/migrations/004_language_calls.sql` + `schema.sql` — Language's first table (the domain's broader shape is still otherwise unscoped — this table exists only for this one slice). `language_calls`: `tutor`, `start_at`, `source_gmail_id` (unique, dedupe key), `status` pending/approved/dismissed. No `raw` column (no AI response to keep) and no `end_at` (not used anywhere in the UI).
- `lib/language-detect.js` — `parseItalkiAcceptance(text)`, pure regex, no network/API call.
- `app/api/language-scan/route.js` — GET (Vercel Cron, weekly `15 8 * * 1`, offset 15 min from the trip-scan cron; gated by `CRON_SECRET` when set) and POST (manual "Scan Gmail" button) both run `runScan()`: deterministic Gmail search `from:noreply@italki.com subject:"has been accepted"` over the last 60 days (verified this exact query against John's real inbox — 4 matches, 0 noise), skip already-suggested message ids, parse, skip anything in the past or unparseable, insert pending.
- `app/api/language-suggestions` (GET pending) and `[id]` (POST approve, DELETE dismiss). Approve just flips `status` — unlike Travel, there's no second table to create into; the row itself **is** the record.
- `lib/tutor-call.js` — `findNextTutorCall()` now merges the Calendar match with the soonest approved `language_calls` row and returns whichever is sooner. `configured` still reflects Calendar specifically (for the "Calendar not connected" message), but an approved italki booking can supply `nextCall` even without Calendar credentials.
- `app/language/page.jsx` (+ `page.module.css`) — "Scan Gmail" button and a review banner (Add / Dismiss per row), same shape as Travel's `SuggestionsBanner`.
- `vercel.json` — added the second weekly cron entry.

**Boundaries held:** read-only Gmail throughout (`messages.list` / `get` only, same as every other Gmail feature). Nothing is auto-added — every booking still goes through John's Approve click, even though the parse itself needed no confirmation-worthy judgment call.

**Verified:** `next build` clean. The italki search query and both sample "accepted" emails were pulled from John's real inbox via the Gmail MCP (read-only) this session — not simulated. The regex parse was checked against both samples' embedded calendar-link timestamps and matched exactly both times. The `language_calls` table and all four query shapes (insert, pending-list, approve, soonest-approved-lookup) were run directly against the live `personal-dashboard` Neon project via the Neon MCP using a temporary test row (removed after verification). Not exercised through the deployed Next.js app itself in this sandbox — same limitation as every prior domain build.

---

## 2026-07-15 (cont'd 7) — Wired Home/Sidebar/TopBar to real data; dropped the fabricated language "weekly goal" stat

John flagged two real problems: the "Up Next" agenda linked to hard-coded mock items instead of what's actually next, and the Home page's Language card showed a hard-coded call time instead of the real Calendar-backed one already live on `/language`. Root cause for both: `app/page.jsx`, `Sidebar.jsx`, and `TopBar.jsx` all read from `lib/mock-data.js` — a placeholder module noted as a known gap in several earlier entries, never actually closed.

**Built:**

- `lib/tutor-call.js` (new) — extracted `findNextTutorCall()` out of `app/api/calendar/route.js` so the Calendar match logic (all five tutor-keyword fixes from earlier sessions, unchanged) has exactly one implementation, now shared by `/api/calendar` and the new aggregator below.
- `app/api/home-summary/route.js` (new) — one aggregator route, five queries run via `Promise.all` (four real Neon queries — `projects` count, the single soonest-upcoming trip, open `schedules` count/soonest-due/items, `ideas` count — plus the shared Calendar lookup). Email is deliberately left as `{ important_count: null }`: no honest cheap count exists without a live Gmail call on every Home visit, which this app's own precedent (Unsplash, Vercel) says not to do. The UI renders `—` for it rather than a fabricated number.
- `lib/agenda.js` (new) — pure `buildAgenda(summary)`, replacing the merge logic that used to live in `mock-data.js`'s `getUpcomingAgenda`. Same sort behavior (bare dates rank end-of-day), now fed by real data.
- `lib/useHomeSummary.js` (new) — a small client hook with a module-scoped cached fetch, so Sidebar + TopBar + the Home page (all mounted together) cost one `/api/home-summary` round trip, not three.
- `app/page.jsx`, `components/Sidebar.jsx`, `components/TopBar.jsx` — switched from the mock functions to `useHomeSummary()` + `buildAgenda()`. `lib/mock-data.js` is now unused and was deleted.
- `components/DomainGrid.jsx` — Language card now renders the real next call (or "No upcoming call found" / "Calendar not connected", matching the Language page's own states) instead of the old hard-coded time. **Dropped the "weekly goal" progress ring entirely** — it had no backing data source or feature anywhere in the spec; keeping a fabricated stat around while fixing two other fabricated stats would have been inconsistent. Schedules and Email cards also gained honest empty/unknown states (no open tasks, no email count) instead of assuming data is always present.

**Verified:** `next build` clean; Prettier passes. The new query shapes (`projects` count, next-upcoming-trip select, `schedules` open aggregate + items, `ideas` count) were run directly against the live `personal-dashboard` Neon project via the Neon MCP and match the API route exactly — confirmed real current state (4 projects, 0 open schedules, 0 open ideas, Morehead as the next trip). Not exercised through the actual deployed Next.js app in this sandbox (no `DATABASE_URL`/Google credentials here), same limitation as every prior domain build.

**Left open:** John's third ask this session — give Language "the same Gmail wiring as Travel" — needs scoping before Build. Posed as a question in chat; tracked above until answered.

---

## 2026-07-15 (cont'd 6) — Built the Schedules domain (was still a stub)

Picked as the next roadmap item: despite the 2026-07-15 "Travel Gmail itinerary import" entry below declaring "all six domains are now built to their v1 scope," `/schedules` was still rendering the `ComingSoon` placeholder, and no `app/api/schedules` route existed — even though the `schedules` table has been in `neon/schema.sql` since `001_initial.sql`. That status line was aspirational, not accurate; this closes the real gap.

Built to the CLAUDE.md §5/§7 spec: title, notes, required `due_date`, status (`open`/`in_progress`/`done`), optional link to a Travel trip **or** an AI project (mutually exclusive, not both).

**Built:**

- `app/api/schedules/route.js` (GET list, joined with `trips.destination` / `projects.github_url` for display — POST create) and `app/api/schedules/[id]/route.js` (PATCH/DELETE), matching the CRUD shape already used by `/api/trips`.
- `app/schedules/page.jsx` (+ `page.module.css`) — replaces the `ComingSoon` stub. A checkbox-style task list (open items first, sorted by due date), an inline "Add task" form with an optional trip/project link dropdown, a due-date chip that flags overdue items, and a small link badge on any task tied to a trip or project.

**Scoped out for now:** the spec's "a linked item's own card shows a small indicator when it has open Schedules tasks" (i.e. a dot on the Travel/AI Projects cards) — that's a small follow-up once Schedules has real usage, kept separate the same way Travel's manual-photo-override UI landed in its own later PR rather than being bundled into the first build.

**Verified:** `next build` clean; `/api/schedules` and `/api/schedules/[id]` registered; Prettier passes. Not exercised against live Neon in this sandbox (no `DATABASE_URL` here) — same limitation noted on every prior domain build; the query shapes mirror `/api/trips`, which was verified directly via the Neon MCP.

**Left for later:** the Idea Board domain has the identical gap (table exists, still a stub) — natural next item, tracked above. The Home/Sidebar/TopBar mock-data wiring gap (also tracked above) is unrelated cross-cutting work, not bundled into this single-domain PR.

---

## 2026-07-15 (cont'd 5) — Fix: pre-key trips never retried their photo fetch

John provisioned `UNSPLASH_ACCESS_KEY` and `CRON_SECRET` in Vercel, then re-saved an existing trip (Panama Cruise, created before the key existed) — still no photo. Root cause in `app/api/trips/[id]/route.js`'s `PATCH`: the auto-fetch retry only fired on a **destination change** or a switch **back to `auto`** from `manual`. A trip already sitting at `image_source = 'auto'` with a `null` `image_url` (because the key didn't exist at creation time) never matched either condition — re-saving with the same destination was a no-op for the photo, so it was **permanently stuck** regardless of the key being added later.

**Fix:** added a third retry condition — `!existing.image_url` — so auto mode also retries whenever it simply hasn't produced a photo yet. One-line change, no schema/API-shape change. John's four in-flight trips (Morehead, Denver, Panama Cruise, Cebu) will pick up real photos the next time each is opened and saved.

---

## 2026-07-15 (cont'd 4) — Built weekly Gmail trip auto-detection

Built the feature scoped in the previous entry, after John answered the four open questions:

1. **Surface:** Travel-page review banner **+** a warning badge on the Home Travel card **+** a bell notification item (John's refinement — all three, not just one).
2. **Cadence:** weekly cron **+** a manual "Scan Gmail" button on Travel.
3. **On approve:** create the trip **and** auto-run the itinerary import from the same email, so it lands populated.
4. **Look-back:** last 30 days per scan.

**Shape as built (same AI-split as itinerary import — deterministic find, Haiku only for the residual):**

- **`neon/migrations/003_trip_suggestions.sql`** + `schema.sql` — new `trip_suggestions` table (`destination`, dates, `source_gmail_id` UNIQUE, `status` pending|approved|dismissed, `raw` jsonb). First status-tracked suggestion queue; dismissed rows are remembered so the scan never re-proposes them.
- **`app/api/trip-scan`** — `GET` (Vercel Cron, weekly `0 8 * * 1` in `vercel.json`) and `POST` (manual button) both run `runScan()`: read-only Gmail search over the last 30 days (`travel-import`'s terms + `-category:promotions/social`), skip already-suggested message ids, `detectTripFromEmail` (Haiku, `lib/trip-detect.js`) per candidate, keep confident hits with a real start date, dedupe against existing trips (shared place-word + date overlap), insert pending. Cron GET is gated by `CRON_SECRET` when set.
- **`app/api/trip-suggestions`** (GET pending + count) and **`[id]`** (POST approve → create trip w/ auto photo + auto-run itinerary import, mark approved; DELETE → mark dismissed).
- **UI:** `SuggestionsBanner` on `/travel` (Add trip / Dismiss per row) + "Scan Gmail" button; `components/TripAlertBadge.jsx` red "N to review" badge on the Home Travel card; top-bar bell now shows a real count + a dropdown of suggestions linking to Travel (replacing the hard-coded `3`).

**Refactors along the way (kept the codebase DRY as the Gmail surface grew):** extracted the Gmail body-text walker into `lib/gmail-body.js` and the whole "fetch a message → parse its itinerary (incl. PDFs)" flow into `lib/itinerary-import.js` (`parseItineraryForMessage`), now shared by the manual import route **and** the approve route. Extended `lib/destination.js` (from the photo fix) is reused by the scan's dedupe.

**Boundaries held:** read-only Gmail throughout (search + `messages.get` + `attachments.get` only); nothing is auto-created — every trip still goes through John's Approve click.

**Unverified live:** built + `next build` clean, but the scan/detect/approve loop hasn't run against real Gmail (no creds here) — worth a preview pass. Also note the top-bar's _other_ counts ("Need attention", "Emails flagged") remain `mock-data` placeholders; only the bell's suggestion count is now real.

---

## 2026-07-15 (cont'd 3) — Travel photo fix + scoped weekly trip auto-detection

Two things after the itinerary-import work landed: a concrete photo fix, and a scoping pass on automating trip entry.

**Travel destination photo — query cleaning + manual override (built).** John's "Panama Cruise" trip rendered the plain gradient. Two causes: (1) `UNSPLASH_ACCESS_KEY` still isn't provisioned in Vercel (the tracked to-do above — without it _every_ trip is the gradient, since `fetchDestinationPhoto` bails on a missing key); (2) even with the key, the query was the literal destination, so "Panama Cruise" would search for cruise-ship stock rather than Panama. Fixes:

- Extracted the generic-trip-word stripping into `lib/destination.js` (`meaningfulWords` / `cleanDestination`) and used it in **both** the Unsplash query (`lib/unsplash.js`) and the Gmail itinerary-import anchor (`app/api/travel-import`) so they can't drift. "Panama Cruise" → "Panama".
- Added a **Photo URL (optional)** field to the trip editor: a pasted URL pins the image (`image_source='manual'`); clearing it hands control back to auto-fetch (`image_source='auto'`, which the PATCH route re-runs on the source change). This closes the gap where the manual-override backend existed but had no UI. No schema change.
- **Still John's step:** provision `UNSPLASH_ACCESS_KEY` (Production + Preview) — until then, auto-fetch returns nothing and trips show the gradient unless a manual URL is pasted.

**Weekly Gmail trip auto-detection — SCOPED (build deferred pending John's answers).** John asked for automation: instead of manually creating a trip then manually importing its itinerary, have the app periodically scan Gmail, propose trips it finds, and ask for confirmation. This is a natural fit — the same AI-assisted, human-confirmed pattern as itinerary import and the email onboarding scan. Drafted design:

- **Trigger:** a weekly Vercel Cron → a protected `app/api/trip-scan` route. (Possibly also a manual "Scan now" button — open question.)
- **Detection (AI-split, same as import):** deterministic Gmail search for travel confirmations (reuse `travel-import`'s `SEARCH_TERMS` + `-category:promotions`), then Haiku extracts `{destination, start_date, end_date, confidence, source_gmail_id}` from each candidate. Only propose confident hits with real dates. Read-only Gmail throughout.
- **Storage:** a new `trip_suggestions` table (`destination`, `start_date`, `end_date`, `source_gmail_id` unique, `status` pending|approved|dismissed, `raw` jsonb). Dedupe against already-suggested `source_gmail_id` and against existing `trips` (destination + overlapping dates). Dismissed suggestions are remembered so they never re-appear — first real consumer of a status-tracked suggestion queue.
- **Surface + approval:** a pending count/list where John reviews each proposal (destination, dates, source email subject) → **Approve** (creates a real trip via the existing `POST /api/trips`, auto-fetch photo, optionally kick off itinerary import) or **Dismiss**. Never auto-creates a trip — the human gate is the whole point.

**Blocking open questions (need John before Build):**

1. **Notification surface.** The Home top-bar counts ("Need attention", "Emails flagged") and the sidebar "Next Trip" are currently **`lib/mock-data.js` placeholders, not live** (confirmed this session). So suggestions can't just "increment the existing count." Do we (a) make that top bar real and route suggestions through it, or (b) use a dedicated banner on the Travel page for v1? (a) is more work but fixes the placeholder bar; (b) ships faster.
2. **Cadence.** Weekly cron only, or also a manual "Scan now" button on Travel?
3. **On approve — auto-run the itinerary import immediately, or leave it a separate step John triggers?**
4. **Look-back window.** How far back should each weekly scan read (e.g. last 30 days of inbox) to catch new bookings without re-surfacing old ones?

Once John answers, this is a ~4-file build (migration for `trip_suggestions`, the cron + scan route, the suggestion/approve UI, and either the top-bar wiring or a Travel banner).

---

## 2026-07-15 (cont'd) — Travel Gmail itinerary import + a scoping refinement on where AI belongs

Built the AI-assisted Gmail itinerary import — the last unbuilt dashboard feature — but first re-grilled the "does AI belong here?" question, since AI-minimalism is this project's whole ethos. The documented flow (CLAUDE.md §7) says "Haiku searches Gmail … then parses," bundling two steps. Splitting them gives opposite answers:

- **Finding the email → NO AI.** This is the Email Tier 1 lesson exactly: Gmail's own search operators do it deterministically and for free. A trip already has a destination; a `(itinerary OR confirmation OR reservation OR booking OR e-ticket OR boarding) {destination}` query surfaces candidates, and John picks one — which is precisely the human fallback the flow already specified for the low-confidence case. No model earns its keep here.
- **Extracting the itinerary → YES, AI.** Confirmation emails are wildly heterogeneous (cruise HTML port tables, airline text segments, hotel prose); no deterministic parser generalizes across providers. This is genuine unstructured→structured extraction — the one thing CLAUDE.md §7 explicitly reserves for Haiku. And note the consequence of dropping it: without the parse, an "import" is just the manual day editor that already exists. **The extraction _is_ the feature.**

John chose this split (deterministic find + Haiku parse). So Haiku is now scoped to the residual here too, mirroring Email — not applied to the step Gmail search already handles.

**Shape:**

- `GET /api/travel-import?tripId=` — deterministic Gmail search (read-only, same hard boundary as Email), returns up to 12 candidate emails (from/subject/date/snippet). No model.
- `POST /api/travel-import` `{ tripId, messageId }` — fetches the ONE chosen email full body (prefers `text/plain`, falls back to stripped `text/html`, bounded to 12k chars), runs Haiku (`lib/travel-import.js`) to extract `{date,title,notes}[]`, returns it. Defensive JSON parse tolerates fences/prose; never invents a date.
- **Never auto-saves.** The parsed days render as a preview modal; "Add N days to itinerary" drops them into the _unsaved_ itinerary editor, and only the existing trip `PATCH` persists them when John clicks "Save changes." Confirm/edit-before-save gate intact.

**Files:** new `lib/travel-import.js` + `app/api/travel-import/route.js`; `app/travel/[id]/page.jsx` / `page.module.css` gain the `ImportModal` (candidate picker → preview) and replace the old disabled stub button. Reuses `lib/email-sender.js`'s header helpers and the existing trip PATCH — no new save path, no schema change. `next build` clean.

**Status:** all six domains are now built to their v1 scope. Remaining tracked work is non-code: the cross-repo `## Next Up` retrofit and `UNSPLASH_ACCESS_KEY` provisioning (both at the top of this file). Live end-to-end parse quality is unverified until exercised against John's real Gmail on the deploy.

---

## 2026-07-15 — Email first-run onboarding scan (last Email v1 piece)

Built the deferred onboarding scan — the final remaining slice of the Email domain. On the first-ever visit to `/email`, the noisiest recent senders are proposed as one-pass Tier 1 hide candidates, checked-by-default; John unchecks any to keep and hits "Hide N senders" (or "Skip"). It never runs again.

**Held to the AI-minimal design (CLAUDE.md §7):**

- **No model.** The "candidate" list is a plain in-memory frequency count of sender domains over the last ~100 read-only inbox messages (the "GROUP BY") — the same header parse Tier 1 already uses, no Haiku anywhere. Only domains seen ≥3 times qualify, top 12 by count, and any domain already carrying an active Tier 1 rule is excluded so the scan never re-proposes what's hidden.
- **One-time, tracked in `app_flags`.** This is `app_flags`' first consumer (the table was scaffolded in 001 for exactly this). `GET /api/email-onboarding` short-circuits on `email_onboarding_done`; the `POST` sets the flag whether John approved everything, some, or nothing (Skip posts an empty list), so it can't re-trigger on the next load.
- **Read-only boundary intact.** Approving a candidate just inserts a Tier 1 `email_rules` row (idempotent guard against duplicates) exactly like clicking "×" on a message — the Gmail mailbox is never touched.

**Files:** new `lib/email-sender.js` (extracted the shared `From`-header parse helpers out of `app/api/gmail/route.js` so the scan and the inbox proxy can't drift), new `app/api/email-onboarding/route.js` (GET scan + POST finish), and `app/email/page.jsx` / `page.module.css` (first-run `OnboardingPopup`). No schema change — `app_flags` already existed. `next build` clean.

**Status:** Email v1 is now complete (Tier 1, Tier 2, onboarding scan all built). Remaining unbuilt dashboard work is Travel's AI-assisted Gmail itinerary import; the cross-repo `## Next Up` retrofit and the `UNSPLASH_ACCESS_KEY` provisioning stay tracked at the top of this file.

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

## 2026-07-14 — Fixed real bugs from live use: Calendar keyword, Email rules UI

John used the deployed app for the first time and found two real problems.

**Calendar wasn't matching his actual tutor calls.** `/api/calendar`'s keyword match was hardcoded to `"italki"` — `CLAUDE.md`'s example host, never verified against John's real calendar. Checked his actual events directly (Google Calendar MCP): they're titled `"Español (n/10 John Shaw)"`, booked through a tutor named Nicolas Cardoso — no "italki" anywhere. Broadened the match to `['italki', 'espanol', 'spanish']` with diacritics stripped before comparing (so "Español" and "espanol" both hit). Still a plain keyword match, no AI, per the original spec — just keywords that match reality instead of the spec's example.

**Email's rules list would grow unbounded on the main screen.** As built, `RulesManager` rendered inline above the inbox and would only get longer as more Tier 1/Tier 2 rules accumulated, crowding out the actual email list. Replaced it with a "Rules" button in the header (shows a count) that opens the same content in a popup/dialog instead — main screen now stays just the inbox regardless of how many rules exist.

**Verified:** `next build` succeeds. The diacritic-stripping regex verified directly in Node against the real event title pulled from John's calendar (`"Español (1/10 John Shaw)"` → matches `"espanol"`). The popup UI itself is unverified visually in this sandbox (same Vercel deployment-protection limitation as every prior PR) — next-session or John's own check should confirm it renders as expected.

---

## 2026-07-14 — Calendar match broadened again: John has multiple tutors

The previous fix (matching `espanol`/`spanish` in the event title) still missed real events: John books through **two** tutors, and one of them (Bruno, `mucho.spanish.bruno@gmail.com`) titles every event just `"John Shaw"` — no language keyword anywhere in the title, location, or description. The only signal is the organizer's email address. A third pattern turned up too: some of the other tutor's bookings are titled `"CLASE n/5 JOHN KENTUCKY"` (Spanish for "class"), which the prior keyword list also missed.

Checked John's real calendar directly again (Google Calendar MCP) rather than guessing. Fixed by widening the match to also check `event.organizer.email` and every `event.attendees[].email`, not just title/location/description/hangoutLink, and adding `"clase"` to the keyword list. This is still the "host match" the original spec describes — CLAUDE.md's phrasing ("keyword/host match... e.g. italki") already anticipated matching on who's hosting, not just the title text; title-only matching just turned out to be insufficient for how John's tutors actually name events.

**Verified:** confirmed directly in Node against all three real patterns pulled from John's calendar — "John Shaw" (Bruno, organizer-email match), "CLASE 1/5 JOHN LOUISVILLE" (Nicolas), "Español (1/10 John Shaw)" (Nicolas) — all three now match, and a control "Dentist appointment" event does not.

---

## 2026-07-14 — Calendar match: third tutor (italki) needed Unicode + vocabulary fixes

Turns out John has a **third** Spanish tutor, through italki itself (Daniel Bermúdez) — separate from the two direct-booking tutors found earlier. italki lessons don't create Calendar events at all (they happen in italki's own in-app classroom); John found the confirmation email himself and added it to Calendar manually via Gmail's "Add to calendar." That auto-created event exposed two more real gaps:

1. Its title got truncated by Gmail's import to `"with 𝐃𝐀𝐍𝐈✨ ( Estudiantes avanzados B1-C2)"` — missing the `"✨SPANISH"` prefix the original italki course name has.
2. What text _did_ survive uses stylized Unicode "mathematical bold" letters (𝐃𝐀𝐍𝐈, not DANI) that diacritic-stripping alone doesn't normalize.

Fixed both: added `text.normalize('NFKC')` before the existing NFD-diacritics-strip, which folds stylized Unicode letters to plain ASCII (𝐒𝐏𝐀𝐍𝐈𝐒𝐇 → SPANISH). And added `"estudiantes"` (Spanish for "students," present in the surviving plain-text portion of this event's title) to the keyword list, since the title alone — even normalized — still doesn't contain any of the existing keywords for this specific truncated case.

**Verified:** confirmed directly in Node against the real event pulled from John's calendar, plus re-ran all three prior real patterns (Bruno/organizer-email, Nicolas "CLASE", Nicolas "Español") and a control non-matching event — all five behave correctly.

**Note for future sessions:** Calendar-based matching is inherently fragile against however each tutor happens to title their invites — this is now the fourth fix to the same keyword list in one day, each time triggered by a real event this session hadn't seen. If a fifth tutor or naming pattern turns up, consider whether keyword whack-a-mole is still the right approach versus something more structural (e.g. an explicit allow-list of known tutor emails, editable from the UI, instead of guessing from event text).

---

## Template for future entries

```
## YYYY-MM-DD — Short title

What changed, what was decided, why. Link related commits/PRs if applicable.
```
