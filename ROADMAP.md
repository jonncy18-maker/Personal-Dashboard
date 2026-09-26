# Roadmap / Session Log

Dated history and session-by-session notes live here, not in `CLAUDE.md`. `CLAUDE.md` stays a living reference; this file is the narrative.

Dated entries before 2026-07-15 have been moved to `ROADMAP-ARCHIVE-2026-H1.md`.

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
- [x] **Run `npm run migrate` after the To-do's + Calendar PR merges** — migration 012 (`email_todos`). Confirmed applied to the live Neon DB (2026-07-21; `schema_migrations` records 012).
- [x] **Run `npm run migrate` after the Calendar-hide PR merges** — migration 013 (`calendar_hidden`). Confirmed applied to the live Neon DB (2026-07-21; `schema_migrations` records 013). _(Migration 014 `calendar_renames` likewise confirmed applied.)_
- [x] **Run `npm run migrate` after the Travel Stats bar PR merges** — 2026-07-25, applied via the Neon MCP right after #61 merged. Migration 015 (`trip_country`) added `country`/`country_code`/`country_geocoded_at` to `trips`; confirmed all three exist and `schema_migrations` records the file. _(Applied statement-by-statement rather than via the runner, so the `schema_migrations` row was inserted explicitly — the net state is identical to a `npm run migrate` run.)_
- [x] **Run `npm run migrate` after the Car/maintenance PR (#101) merges** — 2026-09-13, applied via the Neon MCP right after #101 merged. Migration 026 added the four `vehicle_*` columns to `mileage_settings` plus `maintenance_items` and `maintenance_records`; confirmed every column exists and `schema_migrations` records the file. _(Applied statement-by-statement rather than via the runner, same as prior entries — the net state is identical to an `npm run migrate` run.)_ Original note: — migration 026 (`026_car_maintenance.sql`): the vehicle-profile columns on `mileage_settings` plus `maintenance_items` and `maintenance_records`. Until it is applied, `/car/maintenance` and `/api/maintenance` return errors; Home is deliberately unaffected (`/api/home-summary` reads the maintenance tables in a guarded helper outside its main query batch, precisely so this window can't repeat the #29 outage).
- [x] **Run `npm run migrate` after the Health › Diet PR merges** — 2026-09-16, applied via the Neon MCP right after #114 merged. Migration 028 (`028_health_diet.sql`) added `health_profile`, `health_weight_readings`, `health_intake_entries`; confirmed all three tables exist and `schema_migrations` records the file.
- [x] **Run `npm run migrate` after the Health MCP OAuth PR merges** — 2026-09-17, applied via the Neon MCP ahead of merge (same-day follow-up to #114). Migration 029 (`029_health_mcp_oauth.sql`) added `health_mcp_auth_codes`; confirmed the table exists and `schema_migrations` records the file.
- [x] **Run `npm run migrate` after the steps-tracking PR merges** — 2026-09-17, applied via the Neon MCP ahead of merge. Migration 030 (`030_health_steps.sql`) dropped `health_weight_readings.weight_lb`'s `NOT NULL` and added a nullable `steps` column; confirmed both changes live and `schema_migrations` records the file.
- [x] **Provision `HEALTH_MCP_TOKEN` in Vercel (Production _and_ Preview)** — done, and the claude.ai connector confirmed working live 2026-09-17 after the OAuth wrapper + Vercel-wall saga above (see that run of entries for the full story).
- [x] **Run `npm run migrate` after the watch-fed activity multiplier PR merges** — migration 031 (`031_health_activity_source.sql`) adds `activity_source`/`activity_trailing_days` to `health_profile`. Already applied live to Neon ahead of merge (2026-09-17); confirmed both columns exist and `schema_migrations` records the file — flagging here only for the record, not as pending work.
- [x] **Run `npm run migrate` after the macros/favorites PR merges** — migration 032 (`032_health_macros_favorites.sql`) adds `protein_g`/`carbs_g`/`fat_g` to `health_intake_entries` and creates `health_favorite_meals`. Already applied live to Neon ahead of merge (2026-09-18); confirmed the columns and table exist. Flagging here only for the record, not as pending work.
- [x] **Run `npm run migrate` after the recommended-meals PR merges** — migration 033 (`033_health_recommended_meals.sql`) creates `health_recommended_meals`. Already applied live to Neon ahead of merge (2026-09-18); confirmed the table exists. Flagging here only for the record, not as pending work.
- [x] **Provision `APP_MCP_TOKEN` in Vercel (Production _and_ Preview)** — confirmed working 2026-09-23 (the app-wide MCP connector is in live use). Original note: the bearer token gating the new app-wide MCP server (`/api/mcp/app`, see the 2026-09-17 "App-wide MCP server" entry). Same fail-closed shape as `HEALTH_MCP_TOKEN`. Once set and deployed, add (or repoint) a claude.ai connector at `https://personal-dashboard-jonncy18.vercel.app/api/mcp/app` — same setup flow as Health's connector, "Register automatically" (DCR) for the OAuth client option.
- [x] **Enter the Health profile once** — done; confirmed 2026-09-23 via `get_health_profile` (every body-stat and goal field set). Original note: sex, height, age (or date of birth), activity multiplier, goal weight and goal date. Until then `/health/diet` honestly shows "no target yet" with the missing inputs named, rather than a plausible default. **UI to do this now exists** (see the 2026-09-17 entry below) — click "Edit profile" on `/health/diet`.
- [x] **Run `npm run migrate` after the water-tracking PR merges** — migrations 036 and 037 (`036_health_water.sql`, `037_health_drink_fluid.sql`). Both already applied live to Neon ahead of merge (2026-09-23); table and columns confirmed. Listed only for the record.
- [x] **Run `npm run migrate` after the veggie-servings PR merges** — migration 035 (`035_health_veggie_servings.sql`). Already applied live to Neon ahead of merge (2026-09-23); confirmed all three columns exist and `schema_migrations` records the file. Listed only for the record.
- [x] **~~Build the official-source maintenance sync (PR 2).~~** Closed 2026-09-23, not built: Tesla's CDN 403s Vercel too, and a manual screenshot check against the now-recorded source URL found no changes. See that day's entry. _2026-09-23: probed from a Preview deploy — Tesla's Akamai CDN returns 403 to Vercel too, so an automated server fetch is not viable. Direction (screenshot/paste import vs. drop it) is John's call; see that day's entry._ Deferred 2026-09-13: `tesla.com` is blocked by the dev environment's egress policy, so no parser could be written against observed output. Capture a real fetch from a Preview deploy first, then build fetch → Haiku extract → preview-diff John accepts per row. Must stay a refresh over working data, never a dependency.
- [ ] **Confirm the Model 3 brake-fluid interval.** _Re-checked 2026-09-23: the live manual page still has no number, so the answer has to come from the car's touchscreen or the PDF._ Tesla's own manual page renders "Brake fluid health check every years" with no number, so the seeded item carries a null interval and shows "Set interval". Check the car's touchscreen or the PDF manual and set it.
- [x] **Run `npm run migrate` after the trip-merging PR merges** — 2026-09-07, applied via the Neon MCP right after #93 merged. Migration 023 (`trip_merge`) added `trips.merged_into_id`; confirmed the column exists and `schema_migrations` records the file. _(Applied statement-by-statement rather than via the runner, same as prior entries — the net state is identical to a `npm run migrate` run.)_
- [x] **Run `npm run migrate` after the Travel historical-import PR (#104) merges** — 2026-09-13, applied via the Neon MCP right after #104 merged. Migration 027 added `trip_history_scan` (the resumable-scan cursor row); confirmed the table exists and `schema_migrations` records the file. _(Applied statement-by-statement rather than via the runner, same as prior entries — the net state is identical to an `npm run migrate` run.)_

- [x] **Run `npm run migrate` after the audit-fixes PR merges** — 2026-09-26, applied via the Neon MCP right after #146 merged; confirmed the `server` column exists and `schema_migrations` records the file. Original note: migration 038 (`038_mcp_auth_code_server.sql`) adds `server` to `health_mcp_auth_codes`. Until it's applied, `/authorize` on both MCP servers fails on insert, so reconnecting a claude.ai connector breaks; already-connected sessions keep working since the token itself is unchanged. Apply right after merge.
- [ ] **googleapis 144 → 182 major upgrade** — clears the last `npm audit` item (a moderate `uuid` advisory for v3/v5/v6 with a caller buffer; gaxios/googleapis-common only call `v4()` without one, so not reachable today). Needs the Calendar and Gmail flows checked end to end.

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
- [x] **Travel Stats bar** — 2026-07-21, see entry below. Shipped the four honest tiles (Trips · Nights · Countries · Cruise nights), all from real trip rows. Countries is reverse-geocoded from each trip's already-cached map coords (migration 015), not guessed from the free-text destination. **Points/miles deliberately left out** — still no loyalty-account source, so no invented totals.
- [x] **Wishlist trip status** — 2026-07-17, see entry below. Added `'wishlist'` to the `trips.status` CHECK (migration 009), widened the POST/PATCH validation, and gave it two set-points (a Status select on Add Trip + the existing detail-page Status select) and a Wishlist section on the Travel page. **Run `npm run migrate` after merge** before relying on the deployed code — same one-shared-Neon-DB gotcha as always (CLAUDE.md §6).

---

## Future Domain Ideas (unscoped)

_(Candidates for a future domain/card — not yet grilled. Do not build schema or UI for these until a scoping session resolves the open questions, per the project's own convention of scoping before Build.)_

- [ ] **Periodically re-check the two pinned model IDs.** `lib/anthropic.js`'s `MODEL` (`claude-haiku-4-5`) and `lib/assistant.js`'s `ASSISTANT_MODEL` (`claude-sonnet-5`) are pinned deliberately — a floating model would change the Travel parse, the French import and the assistant's behavior and cost with no deploy and no diff. But pinning only stays safe if something makes us revisit it: raised 2026-09-12 after John hit a sibling project stuck on a hardcoded Sonnet 4.6 well after Sonnet 5 shipped. Both IDs are current as of 2026-09-12. When bumping either, note it here and say what was checked still worked (for Haiku: a Travel itinerary import and a French screenshot import; for Sonnet: a multi-tool assistant turn that writes). CLAUDE.md's guidance deliberately names families only, so it never goes stale this way.
- [x] **Health & Fitness card/subsection — scoped 2026-09-16 as Health › Diet.** Raised 2026-07-13, grilled 2026-09-16 (see the entry below). Resolved: an 8th domain at `/health/diet` (not a card inside an existing domain), data captured primarily through an MCP server rather than in-app AI, v1 slice = calories + weight. The fitness half stays unbuilt — John won't log lifts, so the second tab is deferred until there's a reason for it. Not yet built.
- [x] **PTO planner — scoped 2026-08-08, built 2026-08-08.** Grill session resolved every open question (see the 2026-08-08 entries below for decisions + data model, then the build). Not a 7th domain: a PTO section on `/travel` + one line on Home's Travel card. No AI anywhere in it.
- [x] **Tesla lease mileage calculator — scoped 2026-08-26, built 2026-08-26, "usual trips" baseline added 2026-08-26.** New 7th domain (`/mileage`; renamed to `/car` on 2026-09-13 when maintenance joined it). See the 2026-08-26 entries below for the spec, the mockup review, the build, and the follow-up baseline override. No AI anywhere in it. **Run `npm run migrate` after merge** (migrations 017 and 018).

---

## 2026-09-26 (cont'd) — The rest of the Codex audit: F03, F06–F10

Follow-up to the Assistant/MCP fixes above. John chose the behavior for the two judgment calls: F06 as Codex proposed, and F08 based on the device's timezone.

- **F03 — MCP OAuth codes are bound to the server that issued them.** Migration 038 adds `server` (the issuing token env var) to `health_mcp_auth_codes`. `/token` only redeems, and only deletes, a code from its own server, so a code earned with the Health token can't be exchanged for `APP_MCP_TOKEN`, and a wrong-server attempt doesn't burn the code.
- **F06 — Travel Day Exclusions count only after the anchor reading.** `exclusionMilesAt()` in `lib/mileage.js`: a trip wholly before the latest odometer reading subtracts 0 (the odometer already reflects it), a straddling trip subtracts its after-reading share of days, and a later trip subtracts in full. A projection on the anchor date now equals the reading.
- **F07 — recurring scenarios wait for `effective_start`.** `scenarioImpactAt()` adds the start as a 0-impact mark, so monthly points before it are 0; the 1/2/3-yr checkpoint figures are unchanged.
- **F09 — cruise nights use each cruise segment's own dates.** `collapseMergedTrips()` keeps `own_start_date`/`own_end_date`; cruise segments are unioned so an overlapping cruise leg isn't counted twice. Whole-journey nights and PTO still use the merged range.
- **F08 — "today" on the server is the device's date.** `components/DeviceTimezone.jsx` reports the browser's IANA zone to `/api/device-timezone` (stored in `app_flags`); `deviceToday()` in `lib/device-time.js` replaces every server-side `todayYMD()` in Health and the Home card. The in-app Assistant also sends its own zone per message. The MCP `instructions` date is built on each `initialize` instead of once at cold start. MCP calls from claude.ai use the zone of the device John last opened the app on, so it follows him when he travels. With no zone recorded, the server clock is used, as before.
- **F10 — dependencies.** Non-breaking `npm audit fix`: Next.js 16.2.10 → 16.3.6 (floor raised in `package.json`), sharp 0.34.5 → 0.35.4, plus postcss and qs. The remaining moderate `uuid` advisory needs the googleapis major upgrade (tracked above).

Checked with scratch scripts against the bundled modules (mocked DB):

- F03: a cross-server redemption fails and leaves the code usable; a same-server redemption succeeds once.
- F06: a projection on the anchor date equals the reading; straddling, future and not-yet-ended cases.
- F07: zero before and at the start, positive after, and checkpoints still match.
- F09: a cruise root with a hotel leg, a hotel root with a cruise leg, and an overlapping duplicate leg.
- F08: at 01:00Z on 09-26, an Eastern device gives 09-25; an explicit zone wins; an unset or failing lookup falls back to the server clock.

Also Prettier on the touched files and `npm run build` on Next 16.3.6.

Not changed: the Home card's mileage summary still omits accepted exclusions (`app/api/home-summary/route.js` never loads them), so it can differ from the Car page. This is a separate, pre-existing gap.

---

## 2026-09-26 — Assistant/MCP fixes from the Codex audit (F01, F02, F04, F05)

A Codex audit of `0a20e4d` reported nine defects; Claude Code checked each against the code and agreed with all of them. This entry covers the Assistant/MCP group. The others (the F03 OAuth code binding, mileage F06/F07, Health dates F08, cruise nights F09, dependencies F10) are separate changes, and F06/F08 wait on John's decision about how they should behave.

- **F01 — the app-wide MCP server published the wrong schema field.** `/api/mcp/app` handed the transport the Anthropic-shaped `TOOLS`, so all 111 tools went out with `input_schema` and none with MCP's `inputSchema`. `lib/assistant.js` now also exports `MCP_TOOLS`, the same catalog in MCP's shape plus `annotations` (`readOnlyHint` for GET, `destructiveHint` for DELETE). It is still one catalog written in two wire formats, not a second catalog (CLAUDE.md §7.5).
- **F02 — ID fields were declared `integer`.** Every row the catalog addresses has a uuid key, and email to-dos use a Gmail message id, so the shared `ID` schema is now `string`. The email to-do tools got their own `GMAIL_ID` description.
- **F04 — Health writes made in chat didn't refresh the page.** Action classification only looked in the route catalog, so `log_food` and similar came back `write: false`. Health's read tools now carry `readOnlyHint` in `lib/health-mcp-tools.js`, and `isWriteTool()` reads it. An untagged Health tool counts as a write, so a missed tag causes an extra refresh, never a stale screen.
- **F05 — a model-call failure after a write lost the record of that write.** `runAssistant()` now catches a failure in the model call. If nothing had run yet, it rethrows exactly as before. If tools had already run, it returns the completed actions with a closing assistant turn, so the history keeps alternating, the client refreshes, and a follow-up message sees the tool results rather than repeating them.

Checked with a mocked-provider script run against the bundled module (all tools in MCP shape; no non-string id fields; Health reads and writes classified correctly; mid-turn failure keeps its write; failure before any tool ran still errors), plus Prettier and `npm run build`. The live claude.ai connector was not re-tested.

---

## 2026-09-25 (cont'd 2) — Photo header bands on every domain page

John asked whether generated images could work elsewhere in the app, the way the hero videos did. The first style round, a flat "paper cut-out" landscape and then a risograph print, looked generic, and the fault was mostly the prompt: it put the accent color on the sun, made washed-out periwinkle the dominant color, and repeated one composition. The direction that worked was photographic, matching the hero: alpine lakes and hazy ridges, with exactly one saturated detail in each domain's app color. John generated all sixteen images in ChatGPT (Images 2.5) from a shared prompt, and each was checked at real size in a mockup before building.

- **`PageBanner`** (`components/PageBanner.jsx`) replaces the plain eyebrow + h1 header on Schedules, Travel, Health › Diet, Language, Ideas, Email and AI Projects. Car gets it once, in `app/car/layout.jsx` above its tabs, with the title as a `<p>` so each tab keeps its own h1.
  - The eyebrow and title sit on the photo. The page's existing controls go in a row beneath, not on the photo, because several expand inline (Add idea, New project) or open popovers (Travel's suggestions bell).
  - Only the photo layer is clipped to the rounded corners, so a popover in the row is never cut off.
- **`lib/page-art.js`** maps each domain to its band and a per-image `focus` (vertical `object-position`). The band keeps a thin strip of a 3:2 photo, and each subject sits at a different height; one shared crop cut off the Schedules flag, the Ideas balloon and the tops of the buildings, and lost Car's road and Health's flowers.
- **Schedules "All clear"** swaps its ✓ mark for a 112 px circle of its own photo. The other seven empty-state photos exist but aren't committed. Most pages have no designed empty state yet, so they wait for one; the raw files are on the holding branch `claude/affectionate-shannon-ujnx52`.
- **Size.** ChatGPT's PNGs (~2.3 MB each) became WebP: bands at 1600 px, 90–215 KB each, and the one spot at 43 KB. `public/art/` is 1.3 MB, and each page loads only its own band.
- **Cleanup.** The header rules each page no longer uses (`.header`, `.title`, `.tagline`, Health's `.headRow`/`.headLeft`/`.eyebrow`/`.pageTitle`, Language's `.icon`) were removed from those pages' CSS. Language lost its 64 px top padding, which left a gap above the band.
- **Rule** (now in CLAUDE.md §8): generated images decorate, never document. They show imagined places, not real landmarks, and never stand in for the user's own data, so no generated trip or meal photos.
- **Verified.**
  - `next build` passes.
  - In the built app, every domain page renders its band, and the image loads at full width. Screenshots at 1440px dark and 390px light.
  - Schedules' All-clear was shown with a stubbed task list.
  - Health was shown with a stubbed `/api/health` response built by the app's own `computeTarget`/`dayTotals`, since there's no database here.
  - The Mileage and Maintenance bodies weren't exercised; they need data. The banner sits in the layout above both tabs, and neither tab's own header was changed.

## 2026-09-25 (cont'd) — Hero video for Dawn, Golden and Night

John generated the other three clips with the same prompts and uploaded them to the same holding branch. All four bands now play video, so none of them calls `/api/hero-image` any more.

- **Ping-pong, not crossfade, for these three.** Each changes far more over 8 s than Day. Similarity to the first frame drops to about 16 dB PSNR by the end, against Day's 26.5 dB. A 1 s crossfade would show as a visible dissolve every cycle. So each plays forward and then reversed, into a ~16 s loop that is seamless by construction. The trade-off is that motion runs backward on the return: clouds drift back, and Golden's sun rises again.
- **Per-clip crop point (`focus`).** The horizons sit at different heights in each take (Day ~56% of the frame, Golden ~61%, Dawn ~65%, Night ~70%). With a centered crop, the wide desktop hero lost Dawn's and Night's lake reflections, and Night's bright cloud sat behind the greeting. Each clip's `object-position` is now set so the horizon lands a little below the hero's middle.
- **Night at a higher CRF.** Night's streaming clouds made it 7.3 MB at the Day settings. At CRF 31 it's 3.1 MB, with no visible difference at the hero's size (checked on a full-res crop). Totals: Dawn 2.0 MB, Golden 2.7 MB, Night 3.1 MB (MP4). The WebM fallbacks are only fetched by browsers without H.264.
- **Verified.** `next build` passes. With the clock pinned to each band, the right clip plays at 1440px and 1024px (1440/390 for the first pass). Each band fetches only its own files and never `/api/hero-image`. Screenshots reviewed for all four.

## 2026-09-25 — Home hero: a looping Google Flow video for the Day band

John wanted a video behind the Home hero. A mockup artifact (the real hero layout with an animated stand-in, a crop study and one Google Flow prompt per time-of-day band) came first; John generated the Day clip in Flow and uploaded it to a branch; it was processed and wired in here. No schema change.

- **One clip per band, added one band at a time.** `BAND_VIDEO` in `lib/time-of-day.js` lists the bands that have a clip. Only `day` does today. Dawn, Golden and Night keep the cached Unsplash photo until their clips exist, and a video band skips the `/api/hero-image` fetch. The per-band CSS gradient is still the bottom layer.
- **The clip.** Flow's 8 s 1080p take (6 MB) became a 7 s loop: the last second crossfades into the first, so the end frame is the start frame. The seam was measured, not eyeballed: the last→first frame difference matches an ordinary frame-to-frame step (PSNR ≈30 dB either way). Output is 1600×900, no audio: `public/hero/day.mp4` (H.264, 1.9 MB) and `day.webm` (VP9, 1.8 MB, for browsers built without H.264), plus `day.jpg` as the poster.
- **Motion rules.** Reduced motion or Data Saver gets the poster as a still image and no video at all. Everyone else gets a pause button in the hero's top-right corner (WCAG 2.2.2), remembered per browser in `localStorage`.
- **Legibility.** A video band adds a top-down shade to the scrim, because the Day take's clouds sat behind the widget's "To-do's" column.
- **Service worker.** `public/sw.js` now leaves `.mp4`/`.webm` and any `Range` request to the browser. Network-first would have cached the whole file and broken the byte-range requests Safari plays video with.
- **Raw clip.** The upload went to `claude/affectionate-shannon-ujnx52` (an already-merged branch) and was not merged from there; only the processed files are in this PR. Delete that commit or branch whenever convenient.
- **Verified.** `next build` passes. In the built app at 1440, 1024 and 390px, with the clock pinned to 10:15: the video reaches `readyState` 4 and advances; pause persists across reload; reduced motion renders the poster `<img>` and no `<video>`. Screenshots checked at each width. The test browser is Chromium without H.264, so playback there was the WebM; the MP4 was verified by `ffprobe`, not played.

## 2026-09-24 (cont'd) — Schedules redesign: date groups, all-clear state, quick add, side panel

Built from a before/after mockup John approved. There is no schema change; it's all `app/schedules/page.jsx` and its CSS.

- **What was wrong.**
  - All 7 tasks were done, yet they filled the page at full weight under "Tasks (0 open)".
  - "+ Add task" opened a form inside the header row and reflowed it.
  - The list was one flat, absolute-dated column, with half the desktop width unused.
  - Each row had an Open / In progress dropdown.
  - × deleted on the first click, with no undo.
- **Now.**
  - **Summary strip:** Overdue / This week / Later / Done, each jumping to its group.
  - **Quick-add bar:** one always-visible row for title, date (defaults to today) and an optional trip or project link. Notes are added from a row's edit form.
  - **Groups:** open tasks by date (Overdue with a red edge, This week including today, Later). Every due chip reads both ways ("in 2 days · Sat, Sep 26").
  - **By link view:** groups open tasks by trip or project instead. The choice is remembered per browser in `localStorage`.
  - **All clear:** when nothing is open, the page says so and names the last task finished.
  - **Completed:** done tasks collapse into "Completed · N", newest first, each with "Done <date>".
- **Rows.**
  - A half-filled circle means in progress, and a Start / Pause button replaces the dropdown.
  - Delete is deferred with an Undo toast: the DELETE is sent after 6s, or on unmount; a failed DELETE restores the row.
  - Project badges show just the repo name.
- **Side panel** (stacks under the list below 1100px):
  - A month calendar with a dot per due date: red if overdue, the domain color if open, grey if done.
  - Done-of-total per linked trip or project. These are real row counts.
- **"Done <date>" comes from `updated_at`.** There's no `completed_at` column, and a done row's last update is in practice when it was checked off. It's shown as a date only, never a time. If that ever misleads, the fix is a `completed_at` migration, not a guess.
- **Verified.**
  - Screenshots with the real task list (the all-clear state) and a sample busy week, in dark and light, at 1440, 1024 and 390px.
  - Delete → Undo restores the row with no request sent; without Undo, a single DELETE fires after the window.
  - `next build` passes.

## 2026-09-24 — Home redesign: Today / Horizon groups, state pills, quiet empty cards

A review of the Home page (screenshots at desktop, tablet and phone), then a clickable before/after mockup John signed off before any code. Shipped everything in the mockup except the 6-week horizon strip ("B"), which John skipped.

- **Fixes.**
  - **Phone quote mark.** On phones the quote mark rode up into "Working late, John." It now sits inline before the quote.
  - **Health with nothing logged.** The card led with "1,984 left", which read as a good day. It now says "Nothing logged yet" and puts the target on a secondary line.
  - **Email card.** The permanent "— important" was a dead metric, the kind CLAUDE.md §7 forbids. It now shows the count of starred to-dos from `email_todos`.
  - **Negative PTO.** A negative balance on the Travel card was caption-weight text. It now gets a warn chip, and the scrim is darker so the text stays readable on the trip photo.
- **Layout.**
  - Cards sit in 4 columns (2 on tablet, 1 on phone), split into two groups of four. **Today** holds Health, Schedules, Language and Email; **Horizon** holds Travel, Car, AI Projects and Ideas. Three columns always left an orphan row.
  - The sidebar's "Next trip" card is hidden on Home, where the Travel card already shows the trip.
  - Home has bottom padding so the Assistant button no longer covers a card.
- **State pills.** Every card pill is now derived from data ("In 37 days", "Not started" / "On track" / "Over", "Clear", "Call Mon", "All active"). A card with no state to report shows no pill. Car's "On pace" was the model.
- **Quiet empty cards.** A card with nothing in it (Schedules 0 open, Ideas 0 open, Email 0 starred) drops to a sunken, dashed, untinted style so the cards with data carry the page. The fill is sunken rather than transparent, so it never depends on what's painted behind the card.
- **Stat bar.** "Need attention" was renamed "Next 7 days", because it counts every agenda item, routine calls included. "Open Calendar" is now an outline link; it had been the loudest element on the page.
- **Hero.**
  - The greeting uses the display face of the "John" wordmark, with a mono date line under it.
  - Up Next is wider (up to half the hero), and titles wrap to two lines instead of cutting off.
  - An empty To-do column is narrower.
  - `.body` reserves the widget's width (`--widget-w`), so the larger greeting wraps instead of running under Up Next. It did run under at 1024px, and a sweep caught it.
  - The hero stacks at 1000px (was 900): between those widths Up Next was too cramped.
- **Meters and freshness.**
  - Car shows a Year-1 projection bar against the allowance.
  - Once food is logged, Health shows eaten vs target, plus meals / veg / water chips. `home-summary` now returns `veggie_servings`, `veggie_target`, `water_oz` and `water_target_oz`, computed with the same helpers as `get_day`.
  - Language flags French hours whose import is older than 14 days ("as of Jul 18 · 67 days old"). Every ratio comes from real data; no goal was invented.
- **Verified.**
  - A text-box overlap sweep of the hero and grid at 1440, 1280, 1100, 1024, 1001, 1000, 901, 768 and 390px found no overlaps.
  - Screenshots in dark and light, with today's live summary and a sample logged day.
  - `next build` passes.

## 2026-09-23 (cont'd 2) — Water tracking on Health › Diet, including drinks logged as food

John asked to record water through the day, in the terms he already uses: "I just drank an eight ounce cup of water."

- **Its own table, `health_water_entries` (migration 036), one row per drink.** Not a 0-calorie food entry: an intake row would count toward "N of 4 meals logged", the completeness signal that stops an unlogged day reading as a good one. Per-drink rows (rather than a daily running total) mean the day is a SUM and one mistaken drink can be removed on its own.
- **Units:** stored in US fl oz. `log_water` and the page accept `oz`, `cup` (8 fl oz) or `ml`, converted by `toWaterOunces()` in `lib/health.js`.
- **No default goal.** `health_profile.water_target_oz` is nullable and unset, unlike the veggie baseline John named explicitly. A guessed 64 oz would be a target with nothing behind it (CLAUDE.md §7.3). With no goal the page shows the total alone. John can set one in Edit profile or by telling Claude.
- **MCP:** `log_water` and `delete_water_entry` (confirm-first) join the health tools; `get_day` returns the day's water. Both MCP servers and the in-app Assistant pick them up through `HEALTH_TOOLS`, with no separate allowlist edit.
- **Page:** a Water card in the diet sidebar with one-tap + 8 oz cup and + 16 oz, a custom amount with a unit picker, and the day's drinks (with Remove) behind a toggle. The profile form gains a Daily water goal field.

**Same session: drinks logged as food count toward water (migration 037).** John asked that a protein shake logged as food also count as liquid, and asked whether it should count as a fraction. **Decision: count the liquid it's made with, in full, with no fraction.** Milk, coffee and tea are mostly water, and a guessed per-drink water percentage would add a fabricated number to move the total by ~10%. What keeps it honest instead is visibility: drink fluid is always shown **separately** from plain water ("16 oz water + 12 oz from 1 drink logged as food"). `fluid_oz` (nullable, NULL = not a drink) is on `health_intake_entries` and `health_favorite_meals`, so the usual shake carries it. `log_food`, `update_intake_entry` and `save_favorite_meal` accept it, and `get_day` adds `water_plain_oz`/`water_from_drinks_oz`. Powders and solids don't count, and the tool text says to omit it for alcohol. Migration 037 was applied to Neon ahead of merge.

**MCP coverage check (this session's features):** loaded the real `HEALTH_TOOLS` and the assistant catalog in node. All 20 health tools are present, including `log_water`/`delete_water_entry`. `veggie_servings`+`fluid_oz` are on `log_food`/`update_intake_entry`/`save_favorite_meal`, and `veggie_target_servings`+`water_target_oz` are on `update_health_profile`. Every health tool is in the catalog `/api/mcp/app` serves (111 tools); `/api/mcp/health` serves `HEALTH_TOOLS` directly. Today's other two changes (the launch intro and the Tesla source URL) are UI and data changes with nothing to expose over MCP; the maintenance schedule was already readable through `get_maintenance`.

**Verified:** `npm run build` clean; `toWaterOunces`/`waterProgress` spot-checked in node (8 oz, 1 cup → 8, 500 ml → 16.9, invalid → null; goal unset → `met: null`). Migration 036 applied to Neon via the Neon MCP ahead of merge, with the table and column confirmed. **Not verified:** the Water card in a browser. The local sandbox has no database, so the diet page can't load its data here; check it on the Preview deploy.

## 2026-09-23 (cont'd) — Launch intro rebuilt: "Eight domains, extended", and the overlap fixed

John reported overlapping text in the app-launch intro. **Root cause:** the subtitle ("PERSONAL OS") and the horizon line were placed with `top: calc(42vh + 1.05em)`, where `em` was meant to be the wordmark's `--intro-size` (up to 112px) — but that variable was defined only on the wordmark's element, and the subtitle lived in a sibling layer, so it never received it. The `em` fell back to about 16px and drew the subtitle through the letters. Confirmed with a screenshot of the running intro before changing anything.

**Direction chosen from a round of mockups** (a playable artifact with four options, then an extended version of the one John picked, at 1× speed): one dot per sidebar row (the eight domains plus Calendar), each in its domain colour, spirals in from beyond the viewport and forms a ring around the wordmark. The ring connects and names its domains, each dot pings once clockwise, then the wordmark and subtitle fly into the sidebar's brand slot and every dot arcs to its own row, handing over to that row's icon and label as it lands. ~3.35 s, still once per tab session, still skipped entirely under reduced motion, still decided before first paint in `app/layout.jsx`.

**The rule the new `components/IntroSplash.jsx` is built around: no text ever crosses other text.** How each case is kept:

- **Wordmark vs subtitle:** rows of one flex column (the subtitle's place comes from the wordmark's real height), and `--intro-size` now lives on the root. In flight each part goes to its own measured target on the same duration and easing, so the gap between them stays positive the whole way.
- **Names vs ring and wordmark:** names sit outside the ring, and the ring radius has a floor so its edges' nearest approach (R·cos(180°/n)) clears the text block. All names are gone before the wordmark leaves, since its path runs out past the ring's upper-left side.
- **Sidebar labels:** each stays hidden until its own dot lands. Dots come into their row level from the right, so a dot only ever passes over its own (still hidden) label.
- **Page content:** the cover is now two halves clipped at the sidebar's edge. The sidebar half clears at the hand-off so the dots have somewhere visible to land. The page half, and the `data-intro='handoff'` release of the app's own entrance animations, waits until every dot is inside the sidebar. Holding Home's animations alone would not have been enough: the intro plays on whatever route first loads, and most pages have no entrance animation to hold.
- **No sidebar (<900px):** no names, and the ring disperses outward. The page waits until the wordmark has bowed out and the dots have faded.

The dots are read from the rendered sidebar (`data-nav-href` on each row, `data-brand-sub` on the subtitle, both new), so the intro can never list a row the sidebar doesn't have; only a route → domain-colour map lives in the component. Motion moved from CSS keyframes to the Web Animations API because the ring, the dot paths and the landing points are all measured at runtime. The CSS holds each animated element's starting state, so the server-rendered frame never shows a finished wordmark that then vanishes and replays.

**Verification:** an automated check sampled the whole timeline every 25 ms (137 frames) at 1440×900, 1024×768 and 390×844 in dark, plus 1440×900 in light, and tested every pair of visible text boxes (wordmark, subtitle, ring names, revealed sidebar labels, uncovered page) for intersection: **zero overlaps at every size**. It uses effective opacity (the product up the ancestor chain), and asserts the wordmark, subtitle and names are actually visible at the hold. The check caught three real bugs before merge:

- the cover halves' classes were missing from the stylesheet, so both lookups found the same element;
- a stacking change put the covers above the ring and wordmark;
- on phone the page un-covered while the wordmark was still fading.

Key frames were also reviewed by eye at each size. **Not visually tested:** the collapsed sidebar rail. The code handles it (the mark flies to the "J" slot, the subtitle fades, labels are skipped), but no frame was captured.

## 2026-09-23 — Veggie servings on Health › Diet; a Tesla source probe for the maintenance sync

**Veggie servings (migration 035).** John asked, from a food-logging chat, for vegetable-serving tracking: a per-entry `veggie_servings` field (1 serving ≈ 1 cup raw / ½ cup cooked, USDA guidance), accepted by `log_food`/`update_intake_entry`, a daily `veggie_servings_total` from `get_day`, and a flag for hitting a 2-serving baseline "configurable later". Fiber grams deliberately not built. Decisions:

- **`NOT NULL DEFAULT 0`, as John specified — the one deliberate break from the macros' nullable rule.** Macros stay nullable so "not logged" never reads as "zero grams". Veggie servings only feed a "did the day reach its minimum" check, so an entry nobody assessed can only under-count (the day reads _not met_), never fabricate a success. The tool descriptions tell Claude to set the field whenever a meal contains vegetables, since omission silently means 0.
- **The target is a profile column (`veggie_target_servings`, default 2), not a constant in code** — same treatment as `floor_pct`, so raising it is an `update_health_profile` call, not a deploy. `get_day` returns `veggie_servings_total` / `veggie_target_servings` / `veggie_target_met`; `lib/health.js`'s `dayTotals()` sums it and `veggieProgress()` makes the comparison, so page, API and MCP all share one rule.
- **Favorites carry `veggie_servings` too** (same migration) — logging a favorite copies it into the new entry. Without it, every one-tap log of the usual breakfast would record 0. Recommended meals do not: a logged recommendation gets the column default 0 and can be corrected with `update_intake_entry`.
- **UI stayed small, per the ask:** a "veg servings" input on the add/edit entry forms, a `1.5 veg` tag on timeline rows, and a small Veggies bar under the macros in the sidebar (below the completeness line, so "0 / 2" on an unlogged day reads as "nothing logged"). No new screens. The in-app Assistant and both MCP servers picked up the new fields automatically (they read `HEALTH_TOOLS` directly).

**Official-source maintenance sync — step 1, a probe.** `tesla.com` is still blocked from the dev sandbox (re-tested today: curl and web fetch both refused by the egress proxy). So, per the 2026-09-13 plan, this PR ships `GET /api/maintenance/source-probe`: observation only — it fetches the fixed Model 3 owner's-manual index from Vercel's network, follows up to four same-host maintenance-looking links, and returns status/final URL/content type/candidate links/an excerpt around "interval". No parsing, no AI, no DB writes, no URL input. The actual sync (fetch → Haiku extract → per-row preview diff John accepts) gets built against whatever this returns — including the possibility that Tesla bot-walls Vercel's IPs too, which would change the approach (e.g. a PDF, or John pasting the page) rather than justify guessing.

**Probe result, same day (Preview `personal-dashboard-11xq4bjh3`):** `403 Access Denied` from `AkamaiGHost` on the owner's-manual index — Tesla's CDN blocks Vercel's server IPs too, not just the sandbox. So a server-side fetch sync is not viable as designed. Spoofing a browser to get past a bot wall is off the table, so the remaining options are John-supplied input: a screenshot/paste of the manual's Service Intervals page run through Haiku into the same per-row preview diff (the French-import pattern), or dropping the sync and keeping the seed + manual edits. **Resolved the same session:** John screenshotted the live page instead (`…/ownersmanual/model3/en_us/GUID-E95DAAD9-646E-4249-9930-B109ED7B1D91.html`, 2024+ manual). All five items match the stored schedule word for word, including the still-blank brake-fluid number, so no interval changed. The observed URL is now in `lib/maintenance-presets.js` and on the five live `official` rows in Neon (`source_url`, with `source_fetched_at` 2026-09-23). The probe route was removed. **The automated sync is not being built:** the server can't reach the page, and a schedule that changes this rarely doesn't justify an import feature. Re-verifying means John screenshots that URL again.

**Verified:** `npm run build` clean; `dayTotals`/`veggieProgress`/`parseVeggieServings` spot-checked in node; migration 035 applied to Neon via the Neon MCP and the three columns confirmed. Not yet verified in a live browser or against the MCP connector — same standing caveat as prior Health entries.

## 2026-09-18 (cont'd 3) — Trailing net calorie surplus/deficit

John asked for an "accumulated calorie count," which turned out to mean a trailing net surplus/deficit — sum of (consumed − target) over a window — with a filter to move between weekly/monthly/YTD trailing, and days with nothing logged excluded rather than counted as a full deficit.

**What it does.** New `GET /api/health/net?range=week|month|ytd` sums `consumed - target` across the window's logged days only. `week`/`month` are trailing (last 7 / last 30 days including today, not calendar periods); `ytd` is Jan 1 to today. Because the daily target itself can drift (weight changes, a trailing-steps activity multiplier), the route recomputes `computeTarget()` per day in range rather than reusing one number — expensive enough that this is its own lazy-fetched sidebar card (`NetCaloriesCard`) with its own `useResource` call, not folded into the main day payload every page load already pays for.

**The honesty rule carries over from the single-day completeness signal.** A day with zero intake entries is excluded from the sum entirely — not scored as "ate 0, so full deficit that day." The response reports `daysLogged` against the window's real `daysInRange` (e.g. "net −1,240 · 5 of 7 days logged") so a mostly-unlogged window can't misread as a confident total, and bubbles up `estimated` if any counted day's total wasn't all `label`-tier.

**Verification:** spot-checked the grouping SQL and the profile/weight data directly against Neon — 3 logged days in the trailing week, real body-stat profile, sensible target computation. `npm run build` and `npx prettier --write` clean. Not verified in a live browser — no dev server in this sandbox.

## 2026-09-18 (cont'd 2) — Diet page redesign: timeline over card-grid, after a mockup round

John flagged `/health/diet` as messy — the dark full-width hero banner didn't look good and "Today's meals" (four always-visible meal-bucket sections, each with its own header and Add button even at zero entries) was cluttered. He asked to look at how Travel and Car do minimalism and collapsible sections, so before touching real code this went through a Design-canvas mockup round: five options (A: tidied cards with collapsible sections, B: single-column accordion like Car › Maintenance, C: a chronological timeline with numbers pinned in a sidebar, D: no meal buckets at all — a reverse-chronological chat-style log with a composer bar, E: a dense two-pane table/control-panel). John picked C.

**What shipped, presentation-only (no API or schema changes):** `/health/diet` is now a sidebar (day's numbers, pinned) + main panel (the day as a timeline) layout. The dark hero card is gone — `BudgetRing` moved into a light `.card` and got recolored for it (its track/arc were styled for the dark gradient it no longer sits on). A new `MacroBar` shows protein/carbs/fat as a proportional bar, but only when all three are actually known — a bar built from a partial set would visually claim a split that was never measured, so a partial macro set falls back to legend numbers alone. The four fixed meal-bucket sections are gone; entries render as one chronological timeline ordered by `created_at`, each tagged by a small per-meal color instead of a repeated section header. Favorites and Recommended merge into a "Meal Library": one-tap quick-add chips (only for items that actually have a calorie figure to log) plus a "Manage" toggle that reveals the original full-CRUD cards unchanged.

**One correctness point surfaced during the build, not just a restyle:** a timeline needs to show _when_ something was logged, and the only timestamp on an entry is `created_at` — but that's when the row was written, not when the meal happened. Showing a clock time on a backfilled past day would silently claim a precision the data doesn't have (log yesterday's breakfast this morning and `created_at` reads "now," not "7am yesterday"). Fixed by only rendering a time on `isToday`; a past day's timeline shows the meal tag with no time. Also fixed in passing: `.figureLabel` (used in the Weight & Steps card) had been styled with a semi-transparent near-white color intended for the old dark hero, back when it was already being reused on a light card — a pre-existing low-contrast bug, not something this redesign introduced, now using `var(--ink-muted)`.

**Verification:** `npm run build` and `npx prettier --check` both clean. Not verified in a live browser — no dev server in this sandbox; worth a manual pass over the timeline, the macro bar's all-vs-partial branches, and the meal-library chips once deployed.

## 2026-09-18 (cont'd) — Recommended meals: Claude-curated nudges, separate from Favorites

Immediately after the macros/favorites build, John asked for a "recommended meals" feature — but was explicit it's a different thing from Favorites: "Favorites are stuff that I usually eat, 'recommended food' is moreso trying to get me to a healthier eating baseline." Scoped over a short back-and-forth before building:

1. Different from favorites, confirmed above.
2. Recommendations react to **both** a specific day (remaining calories/macros) and a longer horizon (a standing habit-level suggestion) — hence the `horizon` field (`'today'` | `'ongoing'`).
3. Claude gets full CRUD control of the list, but — John's words — "should confirm with me first... these recommendations will come from Claude chat, and then I'll say, go ahead and push to the app." There's no in-app preview screen for this the way a screenshot import has one; the chat conversation itself is the confirm step, so every write tool's description says outright never to call without John having just agreed in that same conversation.
4. Its own table, not a variant of favorites.
5. A manual fallback on the page too (add/log/delete), when asked directly.

**What got built (migration 033):** `health_recommended_meals` — `horizon`, `for_date` (required for `'today'`, forbidden for `'ongoing'`, enforced by a DB CHECK), `title`/`detail`, and the same optional meal-shaped fields as favorites (`meal`/`calories`/`protein_g`/`carbs_g`/`fat_g`) so a habit-level suggestion can be pure text with nothing to log. No `source` tier on the recommendation itself — logging one always tiers the resulting intake entry `'estimated'`, since it's Claude's own number by construction. Five new MCP tools (`list_recommended_meals`/`add_recommended_meal`/`update_recommended_meal`/`delete_recommended_meal`/`log_recommended_meal`) bring the health tool count to fifteen, plus matching API routes (`/api/health/recommendations`, `[id]`, `[id]/log`) and a Recommended card on `/health/diet` mirroring the Favorites card's shape.

**Verification:** migration 033 applied live to Neon ahead of merge; `npm run build` and `npx prettier --write` both clean (aside from the expected no-parser-for-`.sql` warning). Not verified in a live browser — no dev server in this sandbox.

## 2026-09-18 — Protein/carbs/fat logging and saved favorite meals

John asked to expand food logging in two directions: macro tracking (he already gets AI-estimated macros through the MCP connector with nowhere for the app to put them) and better editing/browsing, which turned out to mean "I eat the same breakfast every day and don't want to retype it." Both landed in migration 032.

**Macros.** `health_intake_entries` gained nullable `protein_g`/`carbs_g`/`fat_g` — nullable for the same reason `steps` is on `health_weight_readings`: an existing or hand-typed row may simply not have them, and a `NOT NULL` default of 0 would misrepresent "not logged" as "zero grams," which this domain never does. `dayTotals()` sums only entries that actually carry a macro and reports a `*Complete` flag per macro so a partial sum can never read as the day's whole figure (mirrors the `~` estimate marker, just per-macro). `log_food`/`update_intake_entry` (both MCP tools, and the page's Add/Edit forms) grew matching optional fields.

**Favorite meals.** New `health_favorite_meals` table — a template (name, optional default meal, description, calories, macros, its own `source`), not a log entry. Logging one (`POST /api/health/favorites/[id]/log`, or the new `log_favorite_meal` MCP tool) copies its fields into a fresh, independent `health_intake_entries` row; editing or deleting that entry afterward never touches the template. Four new MCP tools — `list_favorite_meals`/`save_favorite_meal`/`log_favorite_meal`/`delete_favorite_meal` — bring the health tool count to ten, all still living in `lib/health-mcp-tools.js` and picked up automatically by both MCP servers and the in-app Assistant (no separate allowlist edit needed, since `lib/assistant.js` already consumes `HEALTH_TOOLS`/`isHealthTool` directly). The `/health/diet` page got a matching Favorites card as the manual-path fallback, since John said he mostly logs through the MCP connector rather than the page.

**Verification:** migration 032 applied live to Neon ahead of merge; `npm run build` and `npx prettier --write` both clean (aside from the expected no-parser-for-`.sql` warning). Not verified in a live browser — no dev server in this sandbox; the Favorites card's one-tap re-log and the new macro fields still need a manual check once deployed.

## 2026-09-17 (cont'd 8) — The watch-fed activity multiplier, built (moved off the deferred list)

John asked whether yesterday's steps still influence today's calorie target, expecting the answer to be yes with a caveat. It wasn't built yet — the 2026-09-16 scoping session had explicitly designed this ("steps set the daily multiplier from trailing activity; they never credit calories back intraday") but deferred it, since steps tracking itself didn't exist at the time. Once John confirmed the intent ("go ahead and create that trailing thing and build"), it went from deferred to built in this session.

**What it does.** A profile can now opt `activity_source` into `'steps_trailing'` (default stays `'manual'` — zero behavior change for every existing profile). When opted in, `computeTarget()` in `lib/health.js` averages logged steps over a trailing window (`activity_trailing_days`, default 14) and maps that average onto the same five standard Mifflin–St Jeor activity categories (sedentary 1.2 through extra-active 1.9), banded at 5,000/7,500/10,000/12,500 steps/day. The average is gap-tolerant — a day with no steps row is excluded, never treated as zero — matching how weight and every other dated log in this app already handles gaps.

**The safeguard is the whole point.** The multiplier only ever moves from _trailing, historical_ steps, never from the day's own step count — so there is no intraday calorie credit. A wearable crediting today's steps back into today's target, on top of a multiplier that already assumes elevated activity, would double-count the same movement — worse given wearables' well-documented 20–40% overestimate of active burn. This matches the original design exactly, just built a session later than scoped.

**Honesty on sparse data.** A minimum-data gate (half the trailing window must have logged days) keeps the multiplier from being derived off too few points. Below that threshold, `computeTarget()` reports `activityProvenance: 'steps_trailing_pending'`, falls back to the profile's manual `activity_multiplier`, and the UI says outright how many more logged days are needed — never a silent, unexplained fallback.

**Migration 031** (`health_profile.activity_source` text NOT NULL DEFAULT `'manual'`, `activity_trailing_days` integer NOT NULL DEFAULT 14) — applied live to Neon ahead of merge, same pattern as every prior migration this session.

**Every read path updated to feed steps in:** `app/api/health/route.js` (reuses the trend query already being fetched, no new round trip), `app/api/home-summary/route.js`, and `lib/health-mcp-tools.js`'s `readDay` (so `get_day` over MCP — Health MCP and the app-wide MCP alike — surfaces the same provenance fields Claude can reason about). The `/health/diet` profile form gained the `manual`/`steps_trailing` toggle and a window-size field; the provenance line under the target now shows the resolved multiplier, its category label, and the trailing average behind it, or the "not enough step data yet" honesty message when pending.

**Verification:** `npm run build` clean, `npx prettier --write` clean (aside from the expected no-parser-for-.sql warning). Not verified in a live browser (no dev server in this sandbox) — the golden path (toggle to steps_trailing, log a run of steps, watch the multiplier and label update) still needs a manual check once deployed.

## 2026-09-17 (cont'd 7) — Steps tracking, date navigation, and a Weight/Steps Trend tab

John asked for three more things before disconnecting/reconnecting the MCP connector: step tracking (log + edit, everywhere Claude can already touch Health), the ability to browse days other than today on `/health/diet`, and a Today/Trend split for weight with This Month / Year to Date / custom-range filtering.

**Steps (migration 030).** Joined weight on the same dated row rather than a new table — `health_weight_readings` gained a nullable `steps` column, which forced `weight_lb` to stop being `NOT NULL` (a steps-only day is a real row with no weight in it). `log_steps` is a sixth MCP tool (`lib/health-mcp-tools.js`), upserting by date exactly like `log_weight`. **Deliberately never fed into any calorie math** — this is a display/log-only figure; the activity-multiplier item on this domain's "deferred to v2" list is still deferred, not quietly half-built here. Nullable `weight_lb` surfaced a real bug risk: three separate "latest weight" queries (`app/api/health/route.js`, `app/api/home-summary/route.js`, `lib/health-mcp-tools.js`'s `readDay`) all assumed a row always has a weight, and would have silently broken the target's weight input on a steps-only day. All three now filter `WHERE weight_lb IS NOT NULL` before taking the latest row. Steps themselves are the opposite of that forward-fill: a per-day fact, exact-date only, never "assume yesterday's count."

**Date navigation.** `GET /api/health` already accepted a `date` query param (it always had, for reasons unrelated to this) — so this was purely a client change. `‹`/`›` arrows on `/health/diet` browse any past day; `›` disables at today (no future dates, nothing to show). Add/edit/delete for food entries, and the weight/steps log forms, all now target whatever date is being viewed rather than always "today" — browsing to yesterday and logging a forgotten weigh-in just works.

**Weight/Steps Today vs. Trend.** The card gained two tabs: "Today" (latest weight, the viewed day's steps, both log forms) and "Trend" (the existing chart, now behind a This Month / Year to Date / Custom filter bar). No new endpoint — `TREND_DAYS` in `app/api/health/route.js` went from 90 to 3650 so the client has enough history to slice, and the three filter modes are plain client-side array filtering on bare `'YYYY-MM-DD'` strings (safe: they sort correctly as strings, the same reasoning behind every other date comparison in this app).

**Verified:** `npm run build` compiles clean. Migration 030 applied to the live Neon DB via the Neon MCP (`ALTER TABLE ... DROP NOT NULL` + `ADD COLUMN IF NOT EXISTS steps`, both idempotent). **Not yet verified:** any of this against a live browser session — no dev server here, same standing caveat as the rest of today's entries.

## 2026-09-17 (cont'd 6) — Health entries become editable everywhere, not just deletable

Reviewing the app-wide MCP PR's preview, John hit a real gap: no way to fix a typo or a wrong calorie figure on a logged food entry without deleting and re-adding it. Turned out the backend already supported this (`PATCH /api/health/intake/[id]`, with its re-tier-a-hand-edited-label rule intact) — `/health/diet` had just never grown an edit affordance, only delete.

**`/health/diet` (the page):** added a pencil button next to delete on each entry, opening an inline edit form (description/calories/source, reusing `AddEntryForm`'s field shape). The client only sends `source` in the PATCH when the dropdown was actually touched — sending the unchanged value explicitly would have silently skipped the API's own re-tier rule (a calorie edit with no explicit new source auto-downgrades a `label` row to `estimated`).

**Then John asked for the same capability everywhere Claude can already touch Health** — the in-app Assistant and both MCP servers. Added `update_intake_entry`/`delete_intake_entry` to `lib/health-mcp-tools.js` (now five tools, not three), mirroring the API route's PATCH/DELETE logic exactly including the re-tier rule, so all four surfaces (page, in-app Assistant, Health MCP, app-wide MCP) enforce the identical honesty mechanism from one implementation.

**That surfaced a bigger, pre-existing gap while fixing the smaller one: the in-app AI Assistant had zero Health tools at all**, not just missing edit/delete — `lib/assistant.js`'s `CATALOG` never had a Health section, so John's in-app chat couldn't read or log anything Health-related, let alone edit it. Fixed by merging `HEALTH_TOOLS` into `TOOLS` and adding a Health branch to `executeTool` that dispatches straight to `callHealthTool` (direct DB, via `lib/health-mcp-tools.js`) instead of a same-origin fetch — the one deliberate, documented exception to CLAUDE.md §7.5's "calls this app's own api routes" rule, called out in `lib/assistant.js`'s header comment so a future session doesn't read it as a violation. This one change gave the in-app Assistant full Health parity for free and, since `/api/mcp/app` already imports `TOOLS`/`executeTool` unchanged, let that route's `callTool` collapse from a hand-rolled Health/non-Health branch back down to a single `executeTool` call — one dispatch point instead of two.

**Verified:** `npm run build` compiles clean. **Not yet verified:** the edit UI and the new MCP tools against live data — same standing caveat as the rest of this run of entries.

## 2026-09-17 (cont'd 5) — App-wide MCP server: the whole dashboard over claude.ai, not just Health

Once the Health MCP connector actually worked end to end, John asked for the obvious next step: an MCP server covering the whole app, not just Health. Scoped it in two questions rather than assuming: reuse the in-app AI Assistant's existing allowlisted catalog (`lib/assistant.js`) rather than inventing a broader one, and ship it as one unified server rather than a second standalone one alongside Health's. Both confirmed.

**Refactored before adding anything new, to avoid a second copy of working code:**

- `lib/mcp-oauth.js` replaces `lib/health-oauth.js` — the exact same OAuth handshake, now parameterized by `resourcePath` instead of hardcoding `/api/mcp/health`, so both servers share it.
- `lib/mcp-server.js` is new: `createMcpHandler`, `createAuthorizeHandlers`, `createTokenHandler`, `registerHandler`, and the two `.well-known` metadata handler factories — the JSON-RPC transport, the bearer-token gate, and the whole OAuth wrapper, factored out so a new MCP server is a tool list + a `callTool` function, not a second copy of this plumbing.
- `lib/health-mcp-tools.js` is new: Health's three tools (`get_day`/`log_food`/`log_weight`) and their DB logic, pulled out of `app/api/mcp/health/route.js` verbatim so both that route and the new app-wide one import the exact same module rather than risking drift between two copies.
- `app/api/mcp/health/{route,register,authorize,token}.js` are now thin wrappers over the shared factories — same behavior, same `HEALTH_MCP_TOKEN`, unchanged from the outside. Confirmed via `npm run build` that all the same routes still register.

**What's actually new:** `app/api/mcp/app/route.js` — one server exposing `lib/assistant.js`'s entire `CATALOG` (every domain: Travel, PTO, Mileage, Ideas, Schedules, AI Projects, Email, Calendar/Language — ~40 tools, read and write, Gmail still read-only throughout) plus Health's three tools, gated by a new `APP_MCP_TOKEN` (deliberately separate from `HEALTH_MCP_TOKEN` even though `/api/mcp/app` is now a superset — the two servers stay independently gated). `TOOLS` and `executeTool` are newly exported from `lib/assistant.js` specifically so this route could import them unchanged rather than duplicating the catalog. **No new capability was invented** — a claude.ai connection through this server can do exactly what the in-app Assistant chat panel can already do, per CLAUDE.md §7.5.

**One real gap, closed rather than left as a silent hole:** `lib/assistant.js`'s `systemPrompt()` (Gmail read-only, the Idea/Schedules due-date boundary, the Mileage/Travel-Day-Exclusion opt-in flags, no fabricated metrics, destructive-action confirmation) is only injected inside `runAssistant()`'s own Anthropic call — an externally-connected MCP client's own model never receives it automatically the way the in-app chat does. Extracted that bullet list into an exported `houseRules()` so `/api/mcp/app` can fold it into its MCP `initialize` response's `instructions` field, the closest MCP-native equivalent of a system prompt. Per-tool "Destructive — confirm with John first" wording in `CATALOG`'s own descriptions still applies regardless of caller, since tool descriptions are always part of `tools/list` — but the broader house rules would otherwise only have reached the model in-app.

**Verified:** `npm run build` registers all 14 MCP-related routes (`/api/mcp/app{,/register,/authorize,/token}`, the equivalent four for Health, and the four `.well-known` variants for each). **Not yet verified:** the live connector handshake for `/api/mcp/app` specifically — same caveat as every MCP entry above, no way to drive a real OAuth browser flow from this sandbox. John needs to set `APP_MCP_TOKEN` in Vercel (Production + Preview), redeploy, and add (or repoint the existing) claude.ai connector at `/api/mcp/app`.

## 2026-09-17 (cont'd 4) — Health MCP: Vercel Authentication turned off — connector now unblocked

The bypass-secret theory from the previous entry didn't hold up. John retried with "Register automatically" (DCR) selected in claude.ai's connector settings — the correct choice, since `/api/mcp/health/register` implements RFC 7591 DCR, not the newer CIMD ("Use Claude's published identity") option the UI defaults to. Same error either way. Checked Vercel's runtime logs one more time: identical stopping point as every prior attempt — `POST /api/mcp/health` (401) and `.well-known/oauth-protected-resource/api/mcp/health` (200), then nothing. The bypass _cookie_ Vercel was supposed to set on that first successful response never carried forward to the client's next request (the self-constructed `.well-known/oauth-authorization-server` fetch, which per spec can't carry a query-string bypass either) — confirming this path was a genuine dead end, not a bug in our code.

**Decision: turned off Vercel Authentication (`ssoProtection`) for this project entirely**, via the Vercel MCP's `update_project_deployment_protection`. Weighed against the alternatives (a custom domain — same exposure tradeoff, more setup; a real login layer — reverses CLAUDE.md §7.1's Hard Boundary) and chose this because it's simplest and keeps the actual "no in-app login" design intact rather than fighting it. **Real consequence, stated plainly: the dashboard is now reachable by anyone who has the `.vercel.app` URL — no password, no wall.** That was always closer to this app's stated single-user design than the Vercel-level wall silently providing (undocumented) protection nobody had actually decided to rely on. `HEALTH_MCP_TOKEN` and the OAuth handshake still gate the MCP write tools specifically; the human-facing pages (`/travel`, `/health/diet`, etc.) have no gate at all now, by design, matching CLAUDE.md.

**The `withBypass()` / `VERCEL_AUTOMATION_BYPASS_SECRET` code from the last two entries is left in place, not ripped out** — it's a no-op once that env var is unset or the wall is off, and costs nothing to keep in case the wall ever needs to go back up for a different reason. Don't read its continued presence as "still needed for the connector to work" — it isn't, anymore.

**Not yet confirmed:** whether the connector actually completes now (register → authorize → token → the "enter your Health MCP token" page). Next real signal is John retrying live.

## 2026-09-17 (cont'd 3) — Health MCP: the bypass secret can't sit on the issuer field

John set `HEALTH_MCP_TOKEN`, redeployed, and retried with the bypass secret on the connector URL. Real progress this time — Vercel's runtime logs showed the request actually reaching `/api/mcp/health` (401, as expected) and then `.well-known/oauth-protected-resource/api/mcp/health` (200) — the bypass genuinely got past the wall for both. But the trail went cold right there: no request ever followed for `.well-known/oauth-authorization-server/api/mcp/health` or `/register`, and claude.ai reported the same "couldn't register" error.

**Cause:** `protectedResourceMetadata()`'s `authorization_servers` field had the bypass query string stapled onto it. RFC 9728 requires that field to be a clean issuer identifier — no query string, no fragment — so a spec-following client almost certainly rejected it as malformed and silently gave up before ever trying the next hop, rather than erroring loudly.

**Fix:** `authorization_servers` is back to a bare URL. The bet now is on Vercel's bypass **cookie** rather than a second query param: the 401 response's `WWW-Authenticate` pointer already requests `x-vercel-set-bypass-cookie=true`, so by the time the client reads the protected-resource document, Vercel should have set a bypass cookie on that HTTP session — which, if the client's fetcher preserves cookies across the sequence of calls it makes while setting up one connector, should carry it past the wall for the `.well-known/oauth-authorization-server` fetch too, with no query param needed there since none is allowed. This is the same honest unknown as before: it depends on cookie-jar behavior in claude.ai's backend that we can't inspect from here.

**Unresolved if this doesn't work either:** the wall has now proven it will happily let clean, un-bypassed requests through if a valid bypass cookie is present, but we have no way to confirm from here whether it actually followed through. Next diagnostic step if this fails is the same Vercel runtime-log check — did `.well-known/oauth-authorization-server/api/mcp/health` get hit at all — which tells us definitively whether it's a cookie problem (client never sent one) or something else entirely.

## 2026-09-17 (cont'd 2) — Health MCP: Vercel's own auth wall was the real blocker

John retried the connector after the OAuth wrapper merged and hit the identical error. Checked Vercel's runtime logs across every `/api/mcp/health*` and `/.well-known/*` path for the prior two hours — **zero requests**, even though the production deployment had the new routes. The actual cause: this Vercel project has **Vercel Authentication** (its own login wall, separate from `HEALTH_MCP_TOKEN`) turned on for every `*.vercel.app` URL — confirmed via `get_project_deployment_protection` (`ssoProtection.enabled: true`, `all_except_custom_domains`). That wall intercepts every request at Vercel's edge before it ever reaches app code, so claude.ai's OAuth calls (and, it turns out, any automated caller at all) never got past it.

This wall is very likely what CLAUDE.md §7.1 means by "gate access at the Vercel project level" — probably a Vercel default for a team-owned project rather than something John consciously configured, but it's doing real work: with no in-app login (deliberately, per that same section), it's the only thing stopping the whole dashboard from being openly browsable by URL. John considered adding a real login layer to replace it and reconsider dropping the wall, but that would reverse a documented Hard Boundary for a connector hiccup — instead agreed to try **Vercel's "Protection Bypass for Automation"** first, which pokes a narrow, secret-gated hole through the wall for just this handshake while leaving it up for everyone else.

**Built:** `lib/health-oauth.js` exports `withBypass(url)`, which appends `?x-vercel-protection-bypass=<VERCEL_AUTOMATION_BYPASS_SECRET>&x-vercel-set-bypass-cookie=true` to a URL when that env var is set (a no-op otherwise). Applied to every endpoint URL in the OAuth metadata (`authorization_endpoint`, `token_endpoint`, `registration_endpoint`, the `authorization_servers` entry) and to the `resource_metadata` URL in `/api/mcp/health`'s 401 `WWW-Authenticate` header.

**John's remaining manual step:** turn on "Protection Bypass for Automation" in Vercel (Settings → Deployment Protection) — this auto-provisions `VERCEL_AUTOMATION_BYPASS_SECRET`, nothing to type in. Then, because that secret can only reach requests _we_ construct, the very first hop (whatever URL gets pasted into claude.ai's "Remote MCP server URL" field) has to carry it too: `https://personal-dashboard-jonncy18.vercel.app/api/mcp/health?x-vercel-protection-bypass=<the secret shown in Vercel's settings>`.

**Real uncertainty flagged rather than papered over:** RFC 8414/9728 well-known URL construction is normally done by stripping any query string off the seed URL and inserting a path segment — so it's possible claude.ai's client does the same and drops the bypass param before ever fetching `.well-known/oauth-protected-resource/api/mcp/health`, in which case this still won't work and the real choice becomes custom domain vs. turning the wall off vs. real auth. No way to confirm which without John retrying it live.

## 2026-09-17 (cont'd) — Health MCP: OAuth wrapper for claude.ai's connector

John tried wiring the Health MCP server (`/api/mcp/health`) into claude.ai's chat app via its hosted "Add custom connector" flow and hit `Couldn't register with Personal-Dashboard's sign-in service`. Root cause: claude.ai's connector UI requires OAuth 2.1 with dynamic client registration to reach a remote MCP server at all (per the MCP auth spec) — it has no path for a bare bearer header. The route was built with exactly that bare bearer header (`HEALTH_MCP_TOKEN`), which works fine from Claude Code's MCP config (`--header "Authorization: Bearer ..."`) but not from claude.ai's chat app.

**Built the minimum OAuth wrapper to satisfy that flow, without adding a second credential.** `app/api/mcp/health/register` (dynamic client registration, RFC 7591 — accepts any client, hands back an unvalidated `client_id` since this app has exactly one real credential anyway), `/authorize` (a one-field HTML page asking for the existing `HEALTH_MCP_TOKEN` — the only new UI in the whole flow), and `/token` (exchanges a code for a token). The access/refresh token the flow ultimately returns **is `HEALTH_MCP_TOKEN` itself** — `/api/mcp/health`'s existing bearer check never changed. Migration 029 (`health_mcp_auth_codes`) holds only short-lived (5 min), single-use, PKCE-bound authorization codes — needed because the code issued at `/authorize` is redeemed at `/token` from a possibly-different serverless invocation, so it can't live in memory. Also added the two `.well-known` discovery routes (`oauth-protected-resource` / `oauth-authorization-server`, both at the root and at the MCP resource's own path per RFC 9728/8414) and a `WWW-Authenticate: Bearer resource_metadata="..."` header on `/api/mcp/health`'s 401, so a claude.ai client can discover the whole flow on its own instead of needing anything hardcoded.

**Verified:** `npm run build` registers all 8 new routes (`/api/mcp/health/{register,authorize,token}`, the four `.well-known` variants). Migration 029 applied to the live Neon DB via the Neon MCP. **Not yet verified:** the actual claude.ai connector handshake end-to-end — no way to drive a real OAuth browser redirect from this sandbox. John should retry "Add custom connector" against `https://personal-dashboard-jonncy18.vercel.app/api/mcp/health` once this deploys and `HEALTH_MCP_TOKEN` is set in Vercel.

## 2026-09-17 — Health › Diet: profile editor (closing the v1 gap)

Continued the Health build: migration 028 was confirmed applied to the live Neon DB (checked via the Neon MCP — `health_profile`/`health_weight_readings`/`health_intake_entries` all exist, `schema_migrations` records the file), which surfaced a real gap in the v1 spine — the `PATCH /api/health` endpoint that sets sex/height/age/activity/goal/floor/manual-overrides had no UI. John had no way to actually enter a profile short of a raw API call, so `/health/diet` could never leave "no target yet" for a real user.

**Built:** an "Edit profile" toggle in the page header opens a form (front-end only, no schema change — same `PATCH /api/health` the backend already exposed) covering every `PROFILE_FIELDS` entry: sex, birth date (preferred) with age as the explicit fallback (disabled once a birth date is entered, so the two can't silently disagree), height as separate feet/inches fields converted to `height_in` on submit, activity multiplier, safe floor as a percentage, goal weight/date, and the two manual overrides (floor, target) with their honesty caveats spelled out inline ("stops the formula entirely"). The panel auto-opens once, on first load, only when both `sex` and `height_in` are still null — otherwise it stays collapsed behind the toggle so it doesn't get in the way on every visit. Also fixed `TargetProvenance`'s "no target yet" line, which was joining `missing[]`'s raw keys (`sex, height, age, weight, goal_weight, goal_date`) directly into the sentence — now maps them through a small label table ("sex, height, birth date or age, a weigh-in, …").

**Verified:** `npm run build` compiles clean; Prettier formatted to the repo's config. Not yet exercised in a browser against live data — no dev server/DATABASE_URL in this sandbox — so the actual PATCH round trip against the live profile row (currently still empty on Neon) is unverified until John opens `/health/diet` and enters his numbers.

## 2026-09-16 — Health › Diet: built (v1 spine)

Built the spine scoped earlier the same day (see the entry below it for the twenty decisions and their reasoning). One pass, no audit iterations — the contract was unusually well specified going in, which is what a grill session buys you.

**What landed:** migration 028 (`health_profile` singleton, `health_weight_readings`, `health_intake_entries`), `lib/health.js` (pure, DB-free, shared server/client like `lib/pto.js`), `/api/health` + `/weight` + `/intake` + `/intake/[id]`, the MCP server at `/api/mcp/health`, `/health/diet` with a `/health` redirect, a `--dom-health` token, a Home card, and `.claude/skills/health/SKILL.md`.

**Three things worth recording because they were decided during the build, not before it:**

- **Age is stored twice, deliberately.** `birth_date` is the only representation that cannot go stale — age derives from the server clock — but it demands a date John may not want to type, so `age_years` is the fallback. The API prefers `birth_date`, falls back to `age_years`, and never guesses one from the other or averages them. A single `age_years` column would have silently drifted a year off and quietly moved the target with it.
- **The profile PATCH is read-merge-write, not conditional SQL.** Caught mid-build: a field the caller omits must keep its stored value, while a field sent as `null` must clear it. `COALESCE` cannot express both, and the first draft would have wiped the profile on any partial update. Ten conditional SQL fragments is the wrong shape for a singleton — read it, merge in JS, write it back.
- **Editing a calorie figure by hand re-tiers a `label` row down to `estimated`.** Not in the original spec; it follows from what the tiers mean. A number John retyped is no longer a transcription of a printed figure, so it must not keep the badge that says it is.

**The honesty mechanisms all survived contact with the implementation:** `source` is required at every boundary and never defaulted (a default silently promotes a guess); one non-`label` entry tildes the whole day total; the target returns `null` plus a named `missing[]` list rather than a plausible default; the clamp moves the _date_ and reports a real projected arrival; the weight chart positions X by elapsed days so a gap renders as a gap; and the Home figure never renders without its completeness line.

**MCP auth fails closed, unlike the cron gate it is modelled on.** `/api/trip-scan` runs unauthenticated when `CRON_SECRET` is unset because a stray GET only costs a scan. These tools write to the database, so an unset `HEALTH_MCP_TOKEN` returns 503 instead. Transport is hand-rolled JSON-RPC 2.0 rather than `@modelcontextprotocol/sdk` — no new dependency.

**Verification:** `npm run build` compiles clean, all seven new routes registered. The target math was executed against the figures derived by hand in the scoping session — BMR 1,383, maintenance 2,420, deficit 583, target 1,837, floor 1,452, required rate 1.17 lb/wk — plus the clamp-and-slip path, the goal-already-met path, the tilde rule, and both age-resolution paths: 17 assertions, all passing. **Not verified:** migration 028 has never been executed against a real Postgres (no database reachable from the build container), and nothing has been exercised in a browser or against live data.

## 2026-09-16 — Health › Diet: scoped (not built)

Grill session on a dieting module. Twenty decisions, the design canvas approved, no code yet. The headline is that this **inverts the usual shape of a domain here**: the app is the database, the calculation and the presentation layer, and _Claude is the capture layer_.

**Repo, not a separate app.** Second app would mean a second Vercel project, a second Neon project, a second copy of every env var across Production and Preview, a second migration runner and a second PWA — for a single-user planning hub whose whole premise is one home. It also gets `useResource`/`RefreshProvider`, `num()`, the `route()` convention and the Home card for free, and the Assistant can only ever reach same-origin routes, so a split app would be permanently invisible to it. Car (a genuinely new domain) and PTO (a panel inside Travel) are both precedents for in-repo.

**MCP-primary capture, and the reason is cost, not novelty.** Food photos through `ANTHROPIC_API_KEY` are image tokens billed per meal forever — roughly 1,400 vision calls a year at four meals a day. The same work in a Claude surface John already pays a flat subscription for costs nothing marginal. For a single-user app where John is the only one logging, moving capture out of the app is the correct architecture, not a dodge. The app keeps full capability (manual entry, edit, delete, and in-app photo) as an explicit fallback so a broken connector never means a lost week — John's call, made after the cost tradeoff was put in front of him.

**The three decisions that keep it honest:**

- **The daily target shows its formula, not just its number.** Mifflin–St Jeor over fields John maintains, displayed with its inputs (`122.0 lb, 5'2", 32, male · ×1.75`), with a manual override that wins permanently once set. This is the same _derived-with-provenance_ treatment as Maintenance's interval provenance and Car's checkpoint forecasts — a third category next to "real data" and "hardcoded number", and the one that makes a computed health target defensible under §7.3. Ethnicity is **not** an input to any standard energy equation and is deliberately absent.
- **Three source tiers on every intake entry**, because "how many calories was that" has three genuinely different answers: `label` (read off a nutrition panel or a posted menu — transcription), `recall` (a branded item the model remembers — real number, possibly stale, delivered in the same confident tone either way), `estimated` (pixels or a generic description — no authoritative number exists). A day total containing any estimate renders with a **tilde** (`~1,840`). Same number, different claim. The highest-value path is `label`, not the plate photo — wrapper, menu board and package cover a large share of what actually gets eaten, and text beats pixels every time.
- **The completeness signal on the Home card.** "Calories left today" cannot distinguish _hasn't eaten_ from _hasn't logged_, and at 9pm the second one displays as a triumph. Unlogged food is the one way this module can actively lie, and it's structural, not a bug — missing entries don't look like gaps, they look like success. So the number never appears without `Nothing logged today` / `3 of 4 meals logged` underneath it.

**The goal model.** Target weight 115 lb by 2026-10-28 from 122.0 — 7 lb in 42 days, ≈1.17 lb/wk, inside the sustainable band. When the back-solved target would fall below a safe floor (60% of maintenance, ≈1,450), the target **clamps and the goal date slips**, with the honest projected arrival shown. It does not bend the target to hit the date. At John's activity level the floor doesn't currently bind — an early estimate that it would was wrong, because 20k steps/day is a far higher multiplier than assumed.

**Weight is a dated log, gap-tolerant by design.** John weighs sporadically (weekly as intent), so: no streak counter, no "you missed this week", no interpolation across gaps. Points are plotted where they fall. A stale weigh-in still feeds the target but is **labelled with its age** rather than silently presented as current.

**Steps set the daily multiplier from trailing activity; they never credit calories back intraday.** Two reasons, and the second is the stronger: wearables systematically overestimate active burn (commonly 20–40% high), and more fundamentally, a multiplier that already assumes "very active" and a watch crediting the same steps on top is the _same activity counted twice_. The budget only goes down during the day.

**The calibration idea, deferred but designed for.** John has held 122 lb for over a year at ~20k steps/day — which means his true maintenance is already _measured_, not estimated: it's whatever he's been eating. That's better data than Mifflin–St Jeor will ever produce (a population regression with ~±10% individual error) against a direct observation of one person. So the target gains a third provenance tier later — `formula` → `observed` → `manual` — exactly parallel to Car's usual-trips baseline overriding the naive pace. **Deferred to v2 because it cannot work on day one**; the v1 requirement is only that the schema not make it hard: dated intake rows and dated weight rows are sufficient, no extra tables, no backfill.

**Structure.** `/health/diet` with a `/health` redirect (the `/mileage` → `/car/mileage` pattern), so a second tab later is a new file rather than a route refactor touching the sidebar, the Home card and the PWA start URL. No training log — John logs lifts as "Other workout" on the watch, and won't type them into an app. Noting that **"Other workout" maps to weights** as a real interpretation rule for watch data.

**MCP auth resolves against §7.1 rather than breaking it.** A bearer token in an env var, checked by the route handler — the same shape as the `CRON_SECRET` already protecting the cron GET. That's a shared secret on a machine endpoint, not a user session layer, so "no auth — don't add it back" stays intact. AI-Capital-Planning's MCP server is the pattern to copy.

**Two things the app is explicitly not allowed to be:** the authority on whether 115 lb is the right target for John (a doctor's number goes in the override), and a food database (no Nutritionix/Edamam/FatSecret — a paid third-party vendor outside the GitHub/Neon/Vercel stack was ruled out on infra discipline).

**v1 (the spine):** body stats + goal; computed target with provenance and override; dated weight log + gap-tolerant trend; intake entries (date, meal bucket, calories, description, source); `/health/diet`; Home card with completeness signal; the MCP server.

**v2, deliberately, not by oversight:** protein/macros (the most defensible deferral on the list — at 122 lb lifting in a deficit it's the variable deciding fat vs. muscle); watch-fed activity multiplier; observed-maintenance calibration; push-notification nudges.

Design canvas approved 2026-09-16 (desktop + phone `/health/diet`, goal/target panel, manual entry, Home card in three states). Needs a new `--dom-health` token — proposed berry `#c8446b` light / `#f07aa0` dark, which doesn't collide with Language's green or the critical red.

**Open before Build:** the migration number, and a `.claude/skills/health/SKILL.md` carrying the source tiers, the tilde convention, the clamp-and-slip rule and the completeness signal — all of them domain rules, so they belong in the skill rather than `CLAUDE.md`.

## 2026-09-15 — App-launch intro: the wordmark flies into the sidebar

Home's cards already faded up on load, but on its own that read as a glitch rather than an entrance (John's word). Explored two directions as a design canvas; John picked the expressive one and asked for it bigger.

**The idea that made it worth building: the splash hands over instead of being a curtain.** The wordmark rises letter by letter out of a drawn horizon, a ring traces around it with two particles, one pass of light crosses the composition, the subtitle relaxes into its resting tracking — then the mark flies into the sidebar's brand slot and _stays there_ as the app's permanent mark. Intro and app become one gesture. ~1.9s, once per tab session, skipped entirely under `prefers-reduced-motion`.

Three decisions worth keeping:

- **The flight target is measured, not hard-coded.** `IntroSplash` reads the real `[data-brand-mark]` element's rect and font-size at runtime, so a collapsed rail or a different viewport still lands exactly. Below 900px the sidebar is `display:none`, so there is nothing to fly to and the mark bows out in place instead.
- **The run/skip decision lives in the pre-paint inline script in `app/layout.jsx`, not a React effect.** The splash markup is always server-rendered and CSS only reveals it when `data-intro` is set; deciding in an effect would let the app paint for a frame before the cover appeared — exactly the flash a splash exists to prevent.
- **The app's own entrance animations are held at frame 1 while the cover is up** (`html[data-intro='running'] [data-app-root] * { animation-play-state: paused }`), released on the `handoff` phase. Without that, Home's fade-up burns through behind the cover and the dashboard is sitting there fully arrived when the splash clears. The real sidebar mark stays hidden across both phases so the same mark is never on screen twice.

Two things the browser caught that review would not have: a `text-shadow` halo on the wordmark was being sheared into visible rectangles by the per-letter `overflow:hidden` clip boxes (it is its own layer now), and a hard-coded dark cover flashed white handing over to the light theme — the cover paints `var(--bg-grad)`, the app's own background, so the dissolve has no brightness jump.

---

## 2026-09-12 — CLAUDE.md restructured: always-on core + on-demand skills

**Why.** John had heard that Opus 5 changes how `CLAUDE.md` files should be structured and asked whether ours was worth reviewing. Measured it first rather than assuming: 253 lines, ~6,840 words, ~9,500 tokens loaded on every turn of every session. Section 7 alone was **63% of the file** (4,290 of 6,840 words) and on reading was not really rules — it was a decision archive. The Mileage "usual trips" bullet runs 1,238 characters; the assistant `max_tokens` incident, the Nominatim→Google geocoding switch, PTO's banked-holiday accounting. All genuinely valuable, none of it needed on a turn spent in `app/email/page.jsx`. Two consequences: the rules that are expensive to violate (Gmail read-only, no auth, no fabricated metrics) sat at the same weight as implementation detail, and there was no `.claude/` directory at all, so every domain rule was paying rent in always-on context.

**What moved.** Nothing deleted, summarized, or reworded — a verbatim cut-and-paste with new wrappers. Ten domain skills under `.claude/skills/` (mileage, travel, pto, email, assistant, ai-projects, language, home, schedules, geocoding), each triggered by the paths it covers. `docs/runbooks/google-oauth.md` takes §8's refresh-token runbook (a procedure run about twice a year, previously costing context on all 365). `docs/api-keys.md` takes §2's key table; the security rules themselves stay inline. `ROADMAP-ARCHIVE-2026-H1.md` takes dated history before 2026-07-15, so the session-start instruction to read the latest entry now points at a bounded file rather than a 29,000-word one. The geocoding rule is shared by Travel and Mileage, so it lives in one skill and is cross-referenced by both rather than duplicated.

**What stayed.** Stack + both deliberate divergences, project structure, env vars, the full routes table, the migration convention, §9's Agentic Loop wiring (byte-identical), references. Plus three new sections: **Hard Boundaries** (the 8 rules where a violation is a real incident, on their own where they can't be missed), **Cross-Cutting Rules** (the six §7 blocks that apply to any file — `num()` coercion, refresh signal, API error-handling convention, PWA/never-cache-`/api/*`, Schedules-vs-Ideas, Calendar-in-scope/Drive-not), and a **Map** naming every destination file so a pointer survives even if a skill's trigger misses. Result: 253 → 203 lines, ~9,500 → ~2,400 always-on tokens.

**Two rules added at John's request.** A **maintenance rule** at the end of the Map — before adding anything to `CLAUDE.md`, ask whether it's cross-cutting, domain-specific (→ skill), a procedure (→ `docs/`), or dated history (→ here). John's instinct was to keep a hard line-count cap; rejected in favour of this, because a cap can be satisfied the wrong way (squeezing the stack table into prose, dropping the routes table) and the real failure mode is accretion, not length. Also a **subagent model-selection rule** in §8: pick Haiku/Sonnet/Opus per task by the _cost of being wrong_, not the difficulty — explicitly noting that a mechanically trivial job with no error tolerance is not a Haiku job.

**Loop.** Ran the full Agentic Loop (four activation conditions tripped: 10+ files, new modules, user-visible structural change, well over 5 minutes). Phase 1 outcome and the Phase 2 contract both approved before building. Phase 3 built in an isolated context from the contract alone; Phase 4 audited in a separate isolated context from the contract plus the result. **One iteration.**

**What the audit caught.** `VERDICT: FAIL` on cross-reference staleness — nine in-repo "see §7" references (7 in `CLAUDE.md`, 3 in `docs/api-keys.md`, one borderline) still pointed at §7, which used to be "Key Rules for Claude Code" and is now the 8-line Hard Boundaries section that does not contain what they promise. Each redirected to the skill that now holds the content. The audit found this independently — it was deliberately not told the builder had flagged it, which is the whole argument for the isolated-context design. It also confirmed programmatically what the builder claimed: all 118 lines of old §7+§8 present verbatim in exactly one destination each, zero losses, zero duplications, §9 byte-identical, ROADMAP split lossless (60 dated headings, correct split point, nothing stranded), every skill `description` path resolving on disk.

**Audit note not treated as a defect.** The contract assigned no destination for the "No auth" and "Gmail read-only" blocks, since both became Hard Boundaries one-liners — a genuine gap in the contract, not a builder error. The builder parked them verbatim in §8 and in the email skill respectively so no text was lost. Kept as-is.

**Still unverified.** Whether each skill actually _fires_ on the intended files in practice — only observable across real sessions. Worth watching over the next few: if a domain's rules aren't showing up when its files are touched, the `description` needs tightening.

---

## 2026-09-07 (cont'd 4) — PTO Trips list, one more minimalism pass

John still found the Trips sub-tab cluttered after the round-3 redesign — every trip, counted or not, sat in its own two-line row (name, dates on one line; a verbose "N days · auto"/"override (auto N)" summary plus the edit pencil on the second). Explored two more-minimalist directions on a canvas using John's real trip data (single-line rows either with No-PTO trips just dimmed inline, or collapsed behind one summary line) — John picked the collapse option.

**`TripRow` is now one line**: name, dates, and the day count share a row via a dotted leader (like a table of contents) instead of stacking across two lines; the edit pencil only appears on `:hover`/`:focus-visible` instead of sitting on every row permanently. The verbose "N days · override (auto M)" wording is gone — an overridden count is now just tinted `--accent-ink` instead of spelling out "override" and the auto value in words; seeing or changing the actual override still means clicking through to edit, same as before.

**No-PTO trips no longer take a row each.** New `TripsList` wrapper splits a year's trips into `active` (still shown as the one-line list) and `excluded` (`pto_exempt` trips), collapsing the excluded ones behind a single dashed-border toggle line — "N trips marked No PTO (name, name, …)" — that expands into the same one-line row style on click. If every trip in the year is excluded, the active list shows "No counted trips — everything's marked No PTO." instead of silently rendering nothing.

No schema or API change — `TripRow` still calls the same `onSave` with the same `pto_days_override`/`pto_exempt` patches.

**Verified:** `next build` compiles clean; `prettier --check` passes on both touched files; `next dev` serves `/travel` with 200 and no server errors. Not exercised against live Neon/a real browser in this sandbox — same standing limitation as every prior session.

---

## 2026-09-07 (cont'd 3) — Three real PTO bugs found from John's live screenshot

John pasted a screenshot of the deployed Planning tab and asked "was this merged? this doesn't look right." It was merged, but the screenshot surfaced three genuine bugs — two cosmetic, one a real data-correctness issue:

1. **"1 days" instead of "1 day."** Every hardcoded "days" string in `PtoPanel.jsx` (trip-row summaries, wishlist what-ifs, the sandbox calculator, saved-scenario costs) never checked for the singular case — a pre-existing bug, just newly visible now that trip rows render cleanly enough to notice. Added a `daysWord(n)` helper and applied it at all five call sites.
2. **A negative "left" figure looked identical to a healthy one.** `data.left` can legitimately go negative (over budget) — `lib/pto.js`'s `ptoSummary()` deliberately never clamps it, "shown honestly" per its own comment — but the glance strip rendered it in the same plain ink color regardless. Added `.glanceFigureNegative` (`var(--critical)`, i.e. red) applied when `data.left < 0`.
3. **The real bug: trips outside the selected year were showing up in that year's Trips list at "0 days."** `ptoSummary()` computed `tripCountedDays()` for every upcoming/past trip regardless of whether it actually overlapped the selected year — `tripAutoDays()` already zeroed out non-overlapping trips correctly, but the trip still made it into the returned `trips` list at 0 days, and worse, **a `pto_days_override` on an out-of-year trip would have counted toward whichever year's total happened to be open**, since the override branch in `tripCountedDays()` doesn't check year overlap at all. Fixed by filtering trips to `clampToYear(...) != null` _before_ computing counted days, in `ptoSummary` itself — both the display bug and the override-leaking-across-years bug share the same root cause and the same fix. Verified in isolation (a copy of `lib/pto.js` run directly in Node, since it has zero DB/framework imports): a trip spanning Dec 31 2026 → Jan 15 2027 now correctly shows 1 day under 2026 and 11 under 2027, an out-of-year trip no longer appears in the list at all, and a `pto_days_override: 99` set on a trip entirely in 2028 no longer leaks into 2026's total.

**Verified:** `next build` compiles clean; `prettier --check` passes on all three touched files. The `lib/pto.js` fix was exercised directly (pure functions, no DB) but not through the live `/api/pto` route in this sandbox — same standing no-`DATABASE_URL` limitation as every prior session.

---

## 2026-09-07 (cont'd 2) — Planning tab redesign: PTO Planner sub-tabs, Checklists read/edit split

John felt the newly-folded Planning tab was still cluttered, specifically `PtoPanel` (883 lines, five always-stacked sections: headline, budget/banked chips, the full trip list, manual entries, then three simulation tools) and `ChecklistTemplates`'s expanded template view (a live grid of section+item text inputs even when John just wanted to glance at a list). Explored redesigns on a design canvas first — a compact glance strip + internal Trips/Log/Simulate sub-tabs for PTO (mirroring the outer page's own tab pattern), and a read-then-edit split for Checklists (mirroring the past-trip recap/edit split) — before building.

**`PtoPanel.jsx`/`.module.css`:**

- The old always-stacked headline block + budget/banked chip row collapsed into one **glance strip**: the `left` figure, `taken`/`planned` detail, and the budget/banked chips all in a single row.
- Everything below it now lives behind **Trips / Log / Simulate** sub-tabs instead of five stacked sections. Trips = the existing per-trip auto/override list; Log = the existing manual-entry form + list (dropped its own "Manual entries" header and banked-count tag, since the sub-tab label and the glance strip's banked chip already say both); Simulate = the existing wishlist what-ifs, sandbox calculator, and saved scenarios, unchanged in capability, just grouped under a `simNote` ("Never counted above — planning only") instead of a dashed-border box.
- **`TripRow` is read-only by default.** The override number input + No-PTO checkbox used to sit exposed on every row; now a row shows a plain summary ("8 days · auto") with an edit affordance (`EditIcon`, reused from `components/icons.jsx`), and clicking it reveals the same override/No-PTO controls as before, with a "Done" to collapse back. No behavior removed — `commitOverride`/`toggleExempt` and their optimistic-patch logic are untouched.
- **Dropped the whole-panel collapse** (the old `open`/`toggleOpen`/`localStorage` chevron toggle, `PANEL_OPEN_KEY`) as a redundant second disclosure — the outer Planning tab is already the show/hide layer now that Checklists lives there too, so a panel-level collapse inside it just duplicated that. This is a real feature removal, made deliberately (John approved the mockup, which didn't have it) rather than an oversight.
- The Holidays popup (`HolidaysPopup`) is untouched — already appropriately hidden behind its own explicit "banked" chip, same trigger as before.

**`ChecklistTemplates.jsx`/`.module.css`:** opening a template now shows a new **`TemplateRead`** component — a plain checklist grouped by section (same grouping rule as Travel's itinerary leg headers: a section label renders whenever it changes from the previous item), not the raw editable grid. An explicit **"Edit"** link switches to the existing `TemplateEditor` (unchanged internally, plus a new **Cancel** button to return to read mode without saving). Saving now also flips the card back to read mode automatically. `TemplateCard` also resets to read mode whenever the card is collapsed and reopened, so it never reopens mid-edit unexpectedly. Shortened the header hint paragraph to one line, keeping only the non-obvious fact (editing a template never touches a trip that already copied it) and dropping the more self-evident "apply it from a trip's detail page" clause.

No schema or API change — both components still talk to the same routes with the same payloads; this is purely a client-side reorganization.

**Verified:** `next build` (Turbopack) compiles clean; `prettier --check` passes on all four touched files; `next dev` serves `/travel` with 200 and no server errors. Not exercised against live Neon/a real browser in this sandbox — same standing limitation as every prior Travel-page session; the sub-tab switching, trip-row edit toggle, and template read/edit split are unverified end-to-end, worth a manual click-through on Preview.

---

## 2026-09-07 (cont'd) — Travel page, round three: drop the duplicate hero, fold Checklists into Planning

John reviewed the round-two result live and flagged two more things: the Upcoming tab's big `HeroTrip` photo card just repeated the same soonest trip the Overview strip already names (glance vs. actionable was supposed to be the split, but showing the identical trip twice on the same screen isn't that), and Planning felt thin with only PTO in it while Checklist Templates sat in its own always-visible section outside the tab system entirely — inconsistent given both are trip-prep tools.

**`UpcomingTimeline` now renders every upcoming trip, including the soonest** — `HeroTrip` (and its now-unused `ArrowIcon`) is deleted outright, not just unused; `TimelineCard` already surfaces dates/length/budget/itinerary-planned, so nothing factual is lost, just the oversized photo treatment. Dropped the timeline's own "Then coming up — N more" header too, since the tab label already says "Upcoming" and the count is already on the tab pill — one less redundant label.

**Checklist Templates moved inside the Planning tab**, alongside `PtoPanel`, instead of living in its own `.templatesSection` below the tab system. This is a real behavior change worth flagging: previously `ChecklistTemplates` rendered unconditionally, even before trips loaded or with zero trips; now it only shows once trips exist and Planning is the active tab. John's call, made explicitly ("fold the checklists within planning") — accepted as consistent with putting all trip-prep tools behind one tab rather than a special case for an empty-trips account.

Both are UI reshuffles inside `app/travel/page.jsx`/`page.module.css` — no data model change. Cleaned up now-orphaned CSS alongside the JSX changes: `.hero`/`.heroPhoto`/`.heroScrim`/`.heroBody`/`.heroTop`/`.liveDot`/`.heroEyebrow`/`.heroName`/`.heroCount*`/`.heroFoot`/`.heroChips`/`.heroStat*`/`.heroView*` (all `HeroTrip`-only), `.templatesSection`, and `.sectionHead`/`.sectionTitle` (both now unused after the timeline header was dropped — `.sectionCount` alone is still used by `PastTravelSection`'s year headers).

**Verified:** `next build` (Turbopack) compiles clean; `prettier --check` passes; `next dev` serves `/travel` with 200 and no server errors. Not exercised against live Neon/a real browser in this sandbox — same standing limitation as every prior Travel-page session.

---

## 2026-09-07 — Travel page, round two: notification bell, minimal Overview strip, collapsible map, AI Brief retired

Follow-up to the Overview + tabs restructure below. John walked through the shipped result step by step and asked for three more changes, each explored on a design canvas first (three pages: notification treatment, three Overview-strip options, two Trip Map placements) before building:

1. **The trip-suggestions banner is now a notification bell.** John's "that Trips thing... should be more like a notification button" was the Gmail-detected trip-suggestions banner (potential trips the app found), not the page title — confirmed by "numbers based on the number of potential trips identified." `SuggestionsBanner` (an always-open box under the header) became `SuggestionsBell`: a bell icon + count badge in `.headerActions`, matching the pattern `TopBar.jsx` already uses app-wide, with a popover on click holding the same Approve/Skip rows the banner had. Nothing about the approve/dismiss flow changed, just where it lives.
2. **AI Travel Brief eliminated — not just hidden.** John called it "kind of useless." Since nothing else in the app called `/api/travel-brief` or `lib/travel-brief.js`, both were deleted outright rather than left as dead code behind a removed UI call. The `travel_brief` table stays in `schema.sql` unused, per the immutable/additive migration convention (CLAUDE.md §6) — no down-migration exists in this repo's pattern, and an empty unused table costs nothing. `CLAUDE.md`/`ARCHITECTURE.md` updated to record the retirement.
3. **Overview is now a single "minimal glance strip"** (the option John picked over a hero-forward or stat-forward layout): one row — a small thumbnail, the next trip's name/dates, its countdown, and inline Trips/Countries/Nights/Cruise-nights stats — replacing the old Stats-bar-plus-Brief-plus-Hero stack. The full-fidelity `HeroTrip` photo card didn't disappear — it moved into the **Upcoming tab** as the featured item (above `UpcomingTimeline`'s "then coming up" list), since Overview is now facts-at-a-glance and the rich card is actionable content, same split already used for Past/Wishlist.
4. **Trip Map is collapsed by default, inside Overview** (the option John picked over giving it a dedicated tab). A one-line toggle (`MapToggle` — a pin icon, "N destinations mapped", "Show map"/"Hide map") expands the existing `WorldMap` panel in place; collapsed, it costs nothing. Still gated on `pins.some(p => p.latitude != null)` — no pins, no toggle row.

**Verified:** `next build` (Turbopack) compiles clean (56 routes now — `/api/travel-brief` is gone); `prettier --check` passes on both touched files; `next dev` serves `/travel` with 200 and no server errors. Same standing limitation as every prior Travel-page session — no live Neon/browser click-through in this sandbox, so the bell popover, strip layout, and map toggle are unverified end-to-end; worth a manual pass on Preview.

---

## 2026-09-04 (cont'd) — Travel page restructured: Overview + tabbed sections

Follow-up to the Past travels build above. John felt `/travel` had gotten cluttered — every section (Stats, Brief, Hero, Map, Upcoming, Past, Wishlist, PTO, Checklists) just stacked vertically, with only Past collapsible. Explored three directions on a design canvas (full accordion, segmented tabs, a sticky quick-jump nav) and John picked a combination: tabs for the browsable sections, with an explicitly labeled "Overview" area on top holding the always-visible glance content.

**New structure.** An **Overview** block (Stats bar, AI Travel Brief, Next Journey hero, Trip Map) stays visible above a **tab bar** — Upcoming / Past / Wishlist / Planning — that swaps the content below. Only one tab's content renders at a time (`activeTab` state, default `'upcoming'`), each with its own real-data count (`upcoming.length`, `past.length`, `wishlist.length`; Planning has no single count worth showing). Upcoming's soonest trip stays in Overview as the Hero card, so the Upcoming tab shows only the rest (`UpcomingTimeline`) — showing it twice would be redundant. Past travels dropped its own inner collapsible toggle (migration from the prior session's build): the tab click is now the disclosure, so `PastTravelSection` (search/filter/sort/year-groups, unchanged internally) just renders when the Past tab is active. Wishlist lost its redundant inline "Wishlist" heading — the tab label already says that. PTO Planner moved into the new Planning tab; **Checklist Templates deliberately stayed put** outside the tabs, at the very bottom of the page regardless of trips/tab state — it manages templates independent of any trip existing, and gating it behind a tab would regress the zero-trips case.

Removed the now-unused `sectionHeadButton`/`chevron`/`chevronOpen` CSS (Past's old collapsible-header pattern) rather than leaving orphaned rules. No schema change; front-end only.

**Verified:** `next build` (Turbopack) compiles clean; `prettier --check` passes on both touched files; `next dev` serves `/travel` with 200 and no server-side errors. The tab-click interaction itself and the real Neon-backed data path are unverified in this sandbox — same standing limitation as every prior Travel-page session (no live `DATABASE_URL` here) — worth a manual click-through on Preview to confirm tab switching feels right and nothing regressed for a zero-trips or zero-upcoming account state.

---

## 2026-09-04 — Built out the Past travels section (year grouping, search/sort/filter, per-trip recap)

John asked to build out the existing "Past travels" section on `/travel`, which until now was just a collapsible grid of `PastCard`s with no way to browse or search once it grows. Asked which direction to take it (multiple reasonable options) — John picked all three: richer per-trip recap, filter/search/sort on the gallery, and grouping by year. No schema change; front-end only.

**Shared logic moved to `lib/format.js`** rather than duplicated: `isTripPastByDate(trip)` (the existing date-vs-today check that used to live only in `app/travel/page.jsx` as a local `isPast()`) and `isPastTrip(trip)` (the full "belongs in the Past bucket" rule — explicit `status: 'past'`, or `status: 'upcoming'` with elapsed dates; wishlist trips are never past regardless of dates). Both the Travel list and the trip detail page now import the same helper, so they can't disagree about which bucket a trip falls into — a real risk once the detail page also branches on it.

**`app/travel/page.jsx` — `PastTravelSection`.** Replaces the flat grid inside the "Past travels" disclosure with: a search box (destination or country, case-insensitive substring), a country filter (built from the real `trips.country` values already reverse-geocoded onto past trips — only shown when there's more than one), and a sort select (Newest/Oldest/Longest/Highest budget). Year headers group the results **only** for the two date-based sorts — grouping by year while sorted by length or budget would put trips out of that order under a misleading heading, so those two fall back to one flat grid instead. `PastCard` now also shows the trip's country next to its destination when known.

**`app/travel/[id]/page.jsx` — read-only recap view for past trips.** Previously every trip, past or not, opened straight into the same always-editable form. A trip where `isPastTrip(trip)` is true now opens into a new `TripRecap` view instead: trip stats (length, country, budget, stops logged) and notes as plain read text, and the itinerary as a read-only day list (grouped by leg the same way the editor groups it) rather than a wall of input fields. An "Edit trip" button switches into the pre-existing editable form (unchanged otherwise) with a "← Back to recap" action to return without losing the distinction; saving a trip that's now past (e.g. flipping its Status to Past) drops back into the recap automatically. Upcoming and wishlist trips are unaffected — they still open straight into the editable form as before, since there's nothing to "recap" yet.

**Verified:** `next build` (Turbopack) compiles clean, all existing routes still register including `/travel/[id]`; `prettier --check` passes on every file touched (two pre-existing unrelated warnings elsewhere in the repo, not from this change). Not exercised against live Neon/the deployed UI in this sandbox — same standing limitation as prior Travel-page sessions; the recap/edit toggle and the search/sort/filter logic were traced by hand against the real `isPastTrip` rule and the sort comparators, not run in a browser.

---

## 2026-08-26 (cont'd 9) — Favorite places: manual coordinate override for addresses Nominatim can't find

Root cause confirmed on retry, via the new (cont'd 7) diagnostic logging: production logs showed `searchPlaces: Nominatim found no matches for '20 Quality Pl, Buckner, KY 40010'`. Not a bug — Nominatim/OpenStreetMap's address coverage is community-maintained and genuinely sparse for some rural residential streets (unlike indexed POIs like Kroger/Starbucks, which resolved fine). Confirmed with John this is the real cause, not app-side.

Added a fallback rather than switching geocoders (still free/keyless-only, per CLAUDE.md's standing rule against a paid Maps API): `AddPlaceForm` gained a "+ Can't find it? Enter coordinates" toggle revealing latitude/longitude number inputs, validated to real ranges (±90/±180). When filled, they're trusted directly as the place's coordinates — same as picking an autocomplete suggestion, just sourced from wherever John looked the coordinates up himself (a map app), never a paid API call from this app. No backend change needed: `POST /api/mileage/places` already accepted optional `lat`/`lng` from PR #79's autocomplete work.

**Verified:** `next build` clean, Prettier clean on all touched files.

## 2026-08-26 (cont'd 8) — Favorite places: surface a failed geocode instead of hiding it

John's follow-up, with a screenshot: the "Gym" place he'd just added showed "20 Quality PlBuckner, KY 40010 · could not geocode yet" — missing a space between "Pl" and "Buckner." He said he'd typed the full correct address. The (cont'd 7) autocomplete-race fix didn't cause or fix this — this is a save-time issue, not a suggestion-list issue: the address that got typed/saved was already malformed (no space/comma before the city), Nominatim correctly couldn't resolve it, and the app quietly saved it anyway with `lat`/`lng` null and only a small, easy-to-miss aside noting it. "Could not geocode yet" was also misleading — it implies a transient state that resolves itself, when a malformed address string won't ever resolve on its own.

Fixed the feedback loop, not the typo (the row is real John-entered data — not something to silently rewrite): `addPlace()` in `app/mileage/page.jsx` now returns the saved row instead of void, and `AddPlaceForm.submit` checks it — if `lat` comes back null, it shows a clear inline message ("couldn't verify that address — check for a typo... or pick a suggestion from the dropdown, then delete and re-add") and **deliberately leaves the label/address fields filled in** rather than clearing them, so the exact text that failed stays visible to spot the typo in. The place is still saved either way (an obscure or brand-new address might genuinely have no Nominatim match yet — same fail-soft principle as the rest of Mileage), just no longer silently. The list row's wording changed from "could not geocode yet" to "address not verified — check for typos," since "yet" was never true for a malformed string.

**Verified:** `next build` clean, Prettier clean on all touched files.

## 2026-08-26 (cont'd 7) — Favorite-places autocomplete: fixed a stale-response race, added diagnostic logging

John reported the address autocomplete "couldn't find" real places ("YMCA Oldham county", "20 Quality Pl, Buckner, KY 40010"). Checked production runtime logs (Vercel MCP): typing "YMCA Oldham county" fired **18** `/api/mileage/geocode-suggest` requests in under a minute, all HTTP 200 — but `searchPlaces()` swallowed a non-ok Nominatim response or an empty result into the same bare `[]`, so the logs couldn't distinguish "Nominatim genuinely found nothing" from "got rate-limited/errored." Real, verifiable bug found alongside it: the debounced fetches weren't cancelled, so a slow response to an early partial keystroke (e.g. "YMCA O") could resolve _after_ a later, better query and silently overwrite its results with an empty list.

Fixed both. `lib/geocode.js`'s `searchPlaces()` now logs the Nominatim status code on a non-ok response and logs (not just fails soft) a genuine zero-result match, so the next occurrence is diagnosable from Vercel runtime logs instead of just "didn't work." `AddPlaceForm` in `app/mileage/page.jsx` now uses an `AbortController` to cancel the in-flight request when a newer one starts, plus a request-identity check so even an unaborted stale response can't clobber a newer result.

Could not reproduce the two specific failing queries directly — this sandbox's network proxy blocks both `nominatim.openstreetmap.org` and the live Vercel domain, so I couldn't confirm whether Nominatim itself has no match for "YMCA Oldham county" (plausible — free-text POI+county queries are a known Nominatim weak spot without a city) versus a transient rate-limit from the request burst. Flagged this limitation rather than guessing. **Next step if it recurs:** check Vercel runtime logs for the new `searchPlaces:` log lines — they'll say definitively.

**Verified:** `next build` clean, Prettier clean on all touched files.

## 2026-08-27 — Two real bugs found from John's questions: the forecast anchor, and a silent AI Assistant failure

John asked two direct questions in quick succession and both surfaced real, fixable bugs rather than just needing an explanation.

**Bug 1 — "usual trips" ignored the actual logged odometer.** John: "everything should start with the actual odometer reading... the 'usual trips' override should just be the forecast side." Checked the math and confirmed a real gap: `projectCheckpoint()` always computed `starting_odometer + pace × days-since-lease-start`. Without the override this happens to be algebraically identical to "current logged odometer + pace × days remaining" (the two anchor points fall on the same line), but with `usual_active` on, the projection recomputed from lease start using the hypothetical rate and never touched the real logged odometer at all — logging a new reading had **zero effect** on the forecast whenever "usual trips" was active. Fixed: `projectCheckpoint()` now takes an explicit `anchorDate`/`anchorOdometer` (the latest real logged reading, or the starting odometer if none logged yet) and extrapolates forward from there in both baseline modes — the override now only ever replaces the forward-looking rate, never the actual miles already driven, matching exactly what John described.

**Bug 2 — the AI Assistant went silent on a multi-part request.** A 3-instruction message (adjust dates, set a mileage figure, keep it scenario-only) got `(no reply)` twice in a row, including on a simple unrelated follow-up question. Checked Vercel runtime logs: all three `/api/assistant` calls returned 200 with no server error — meaning the response body itself carried an empty reply, not a crash. Root cause in `runAssistant()`'s loop: the terminal branch fired on `response.stop_reason !== 'tool_use'` with no distinction for _why_ the turn ended, so a response cut off by the 4096-token output cap (`stop_reason: 'max_tokens'`) looked identical to a normal finish — it returned whatever partial (often empty) text existed at the cutoff and silently dropped any tool call still mid-write, with zero indication anything had gone wrong. Fixed: an explicit `max_tokens` branch now returns an honest message (naming how many changes from earlier iterations _did_ go through, since `actions` already reflects those, and asking John to continue rather than implying nothing happened). Also raised `MAX_TOKENS` 4096 → 8192 so a normal multi-tool-call-plus-summary turn has real headroom before ever hitting this path.

**Verified:** `next build` clean, Prettier clean, dev server smoke-tested (`/` and `/mileage` both 200, no crash). Numeric anchor-fix logic verified by hand (algebra check, not a live Neon DB in this sandbox).

## 2026-08-26 (cont'd 12) — Travel Day Exclusions: a new Mileage section, not a scenario

The Google Timeline detour (checking whether 3 years of location history could estimate unmodeled weekend driving) hit a real wall — the account's Timeline backups are end-to-end encrypted, so not even Takeout/the phone's own export can hand back the processed trip segments, only raw GPS/WiFi pings covering a few weeks. Dropped that path. John's actual insight while discussing it: "generally scenarios are reserved for trips, and when trips happen, that means the normal daily drives do not happen" — a real trip should _subtract_ baseline driving from the forecast, not just add an unmodeled gap. He also asked for this to be a distinct section from Forecast Scenarios (a real fact, not a hypothetical), auto-detected from Travel but never auto-applied, and reviewed the same way Travel's own Gmail trip-suggestion queue works.

**Migration 022** adds `mileage_travel_exclusions` (trip_id nullable so a manual entry fits the same shape as a Travel-linked one; `status` accepted/dismissed; `source` travel/manual; `daily_rate_used`/`miles_excluded` snapshotted at accept time). `lib/mileage.js` gained `tripDayCount()` and `travelExclusionMiles()`, and `projectCheckpoint()` now takes an `exclusions` array — unlike a scenario's linearly time-scaled impact (a recurring habit grows with elapsed time), an exclusion is a flat one-time subtraction applied in full once its trip's end date has passed a given checkpoint, never partially.

`GET /api/mileage` now also returns `travelExclusions`, `pendingTravelTrips` (real dated trips never reviewed — what auto-pops the popup once per page load) and `reviewableTravelTrips` (undecided or previously dismissed — what the panel's "Scan travel" button re-surfaces; dismiss is a snooze, not a permanent skip). New `app/api/mileage/travel-exclusions/route.js` (POST — accept a trip_id, dismiss a trip_id, or add a manual label+date-range entry, computing `miles_excluded` server-side from whichever baseline pace is currently active) and `[id]/route.js` (DELETE — undo). New UI: a `ReviewTravelPopup` (accept/dismiss per trip, with a live "would exclude ~X mi" preview) and a `TravelExclusionsPanel` (accepted list + manual-entry form + the Scan travel button), both new components in `app/mileage/page.jsx`.

Cataloged for the AI Assistant in the same PR (learned that lesson the hard way this session): `accept_mileage_travel_exclusion`, `dismiss_mileage_travel_exclusion`, `add_manual_mileage_travel_exclusion`, `delete_mileage_travel_exclusion`, plus `get_mileage`'s description updated to name the new fields. System prompt: never accept/dismiss an exclusion without John asking for that specific trip, same opt-in posture as `usual_active` and a scenario's `active` flag.

**Verified:** `next build` clean, Prettier clean on all touched files, dev server smoke-tested (`/` and `/mileage` both 200, no crash). **Run `npm run migrate`** (migration 022) after merge.

## 2026-08-26 (cont'd 11) — Switched geocoding from Nominatim to the Google Geocoding API

Follow-up to the Mileage geocoding investigation earlier today: John's take after seeing Nominatim genuinely had no data for a real Buckner, KY address — "It's free to a certain point I believe and I don't think I'll get to that point, so we should just configure it out." A deliberate reversal of the app's standing "free/keyless-only" geocoding rule, made explicitly by John after seeing the real failure mode, not a rule quietly relaxed.

`lib/geocode.js` — the single module every geocode/reverse-geocode call in the app goes through — now calls the Google Geocoding API instead of Nominatim, keeping every exported function's signature and `'ok'/'none'/'error'` status contract identical, so no caller (Travel's trip map + country stats, Mileage's places/trip-journal/usual-legs, `lib/route-distance.js`) needed a code change. Requires a new `GOOGLE_MAPS_API_KEY` (server-only); a missing/invalid key fails soft to `'error'`, same as any other transient failure. Scope is geocoding only — OSRM driving-distance routing, the static world-map SVG, and the "no paid map-tile provider" rule are untouched and still free/keyless; this was never about routing or maps rendering, just point lookups.

Updated every comment/doc that asserted the old Nominatim-specific facts (rate limits, "deliberately not Google Maps" language) across `lib/geocode.js`, `lib/route-distance.js`, `lib/itinerary.js`, `app/api/travel-stats/route.js`, `app/api/mileage/geocode-suggest/route.js`, `app/mileage/page.jsx`'s manual-coordinates hint text, `ARCHITECTURE.md`, and `CLAUDE.md` §2/§4/§7 — left ROADMAP's own past entries and the immutable migration files untouched, since those are historical record of what was true when written, not living reference.

**Not yet live**: this ships the code path, but needs `GOOGLE_MAPS_API_KEY` actually created (Google Cloud Console → enable the Geocoding API on a billing-enabled project → create an API key) and added to Vercel (Production + Preview) before it does anything — until then every geocode call fails soft to `'error'`, same as a missing key always has for every other integration in this app.

**Verified:** `next build` clean, Prettier clean on all touched files.

## 2026-08-26 (cont'd 10) — AI Assistant: paste/drag-drop/attach images and files

John's follow-up after the Mileage catalog fix: "we really did not do a good job of building it out" — the assistant could read/act on dashboard data but had no way to see anything John shared visually (a screenshot of a to-do list, a receipt, a PDF). Asked for it to ingest "anything Claude can ingest."

`components/AssistantPanel.jsx` gained paste (`onPaste` on the input), drag-and-drop (over the whole messages pane, with a "Drop to attach" overlay), and an explicit paperclip/file-picker button. Three attachment shapes, handled differently by design rather than uniformly base64-encoding everything:

- **Images** (png/jpeg/gif/webp) → Anthropic `image` content blocks. Large ones (phone photos, full-page screenshots) are downscaled via canvas to a 1600px max dimension and re-encoded as JPEG q0.85 before sending — this isn't a Claude limitation (it downscales oversized images internally anyway), it's Vercel's serverless request body-size ceiling, which base64 inflation eats into fast.
- **PDFs** → base64 `document` blocks, the API's real mechanism for PDFs.
- **Text-like files** (`.txt`/`.csv`/`.md`) → read client-side as text and inlined as a plain `text` block, deliberately _not_ forced through the document-block base64 path — that source type is for PDFs; a bare text file is unambiguous and more robust sent as text.

`app/api/assistant/route.js` validates every attachment server-side regardless of what the client claims (allowed media-type allowlist, per-attachment and total size caps) — the same "never trust the client alone" posture as every other route. Its history-trimming boundary check (`isSafeTrimBoundary`) was also broken by this change in a way worth calling out: it previously only recognized a plain-string user turn as safe to start the resent window at; once a user turn could be a multimodal content array, the search would silently walk off the end of the array and return an **empty** trimmed history. Fixed to recognize an array turn as safe too (as long as every block is text/image/document, never a stray tool_result), with a fallback to the untrouched full history if no safe boundary exists at all rather than ever slicing to nothing.

System prompt updated: John can now share images/PDFs/text directly, and the assistant should read them like any other input — an attachment is context, not itself a write; turning "here's a screenshot" into real dashboard data still goes through the matching tool call.

**Verified:** `next build` clean, Prettier clean on all touched files, dev server smoke-tested (`/` and `/mileage` both 200, no crash — AssistantPanel mounts app-wide via AppShell).

## 2026-08-26 (cont'd 6) — AI Assistant: added the missing Mileage tool catalog

John asked to build his Mileage "usual trips" baseline through the AI Assistant, and it turned out the assistant had **zero** Mileage tools — the whole 7th domain was built across five PRs this session without ever adding a `lib/assistant.js` catalog entry for it, so the assistant could not read or act on Mileage at all despite CLAUDE.md §7's rule that a new route is only actually assistant-usable once cataloged.

Added 13 tools covering every Mileage route: `get_mileage` (full state — settings, odometer log, trip journal, scenarios, usual-trip legs, favorite places, computed forecast); `update_mileage_settings` (lease fields **and** the `usual_miles`/`usual_period`/`usual_active` baseline override — the specific ask); `add_/delete_mileage_reading`; `add_/delete_mileage_trip`; `add_/update_/delete_mileage_scenario` (manual or leg-based, same server-side-computed-impacts rule as the UI); `add_/delete_mileage_usual_leg`; `add_/delete_mileage_place`. System prompt updated: domain count six → seven, Mileage named explicitly, and a house rule added so the assistant never flips `usual_active` or a scenario's `active` flag without John asking for that specific outcome (mirrors the existing delete-confirmation rule).

No new API routes — every one of these already existed from the Mileage build; this was purely wiring the existing routes into the catalog the assistant is allowed to call, same allowlist-only shape as every other domain.

**Verified:** `next build` clean, Prettier clean, no duplicate tool names in the catalog (checked directly).

## 2026-09-13 (cont'd) — Travel: one-time historical Gmail import (migration 027)

John asked to pull past trip history into Travel — "there should be a lot of past history." Two open questions resolved with John via `AskUserQuestion` before building: how far back (**2015**, his call), and how to handle Gmail's newest-first pagination against a single request's duration cap on a search spanning 10+ years (**resumable multi-page scan**, his call, over a one-shot best-effort).

**Built on the existing weekly trip-scan, not a new pipeline.** The weekly scan (`app/api/trip-scan`, 003) already does exactly this shape of work — deterministic Gmail search → Haiku `detectTripFromEmail` → dedupe against known trips/suggestions → insert a `pending` row into `trip_suggestions` for John to Approve/Dismiss on `/travel` — just hardcoded to a 30-day lookback for ongoing new-booking detection. Pulled the search vocabulary (`SEARCH_TERMS`, `TRAVEL_SENDER_DOMAINS`), the query builders, and the dedupe/concurrency helpers out into `lib/trip-scan-shared.js` so both scans share one definition of "what counts as a trip email" and one definition of "is this candidate already accounted for" — they can't drift apart. `app/api/trip-scan/route.js` itself is unchanged in behavior, just re-wired onto the shared module.

**The historical scan (`app/api/trip-history-scan`) is the same detection pipeline, resumable.** `after:2015/01/01` instead of a 30-day window means Gmail can return years of matches, and Gmail lists newest-first — so getting to the OLD end means paging through, which won't fit one request. Migration 027 (`trip_history_scan`, one fixed row) freezes the ordered query list (the primary search + one query per travel-sender-domain allowlist entry) at scan start and tracks a cursor (`query_index`, Gmail's own `page_token`) plus running totals. Each POST to `/api/trip-history-scan` runs one ~50s time-boxed chunk against that cursor, updates it, and returns whether it's done — so the "Import Trip History" button on `/travel` can be clicked repeatedly (label switches to "Continue Import") until the whole range is covered, without ever rescanning a page it already processed. A GET reports current progress (for the button label / note) without touching Gmail.

**No new review surface — suggestions land in the same bell/Approve/Dismiss flow** the weekly scan already built, so this needed no new UI beyond the one button + progress note; hard boundary #4 (no AI import ever auto-saves) is unaffected because nothing here is new in that respect, just a wider `after:` date on an existing preview-first pipeline.

**Run `npm run migrate` after this merges** — migration 027 adds `trip_history_scan`; until applied, `/api/trip-history-scan` will error on both GET and POST.

**Verified:** `next build` clean, Prettier clean.

## 2026-09-13 — Mileage became Car; maintenance schedule built (migration 026)

**John's question, in order: should Tesla maintenance live inside Mileage or separately, and should the domain stay "Mileage" or become "Car" with sections?** Answer taken: Car, with `/car/mileage` and `/car/maintenance` as two tabs. Maintenance genuinely needs the odometer log — service intervals are mileage-and-time based — so a separate 8th domain would have split one data model across two places. A single page called "Mileage" holding a maintenance panel would have been the same mismatch in the other direction. Same shape as Travel hosting the PTO Planner: a second concern on a domain page, not a new domain.

**The rename is page routes only.** Every `/api/mileage/*` path kept its URL, so the assistant's allowlisted tool catalog needed no edits, and `DOMAIN_META`'s key stays `mileage` (it addresses the domain's data across home-summary, the agenda and the assistant — renaming it would be a wide rename for a label change). `/mileage` stays as a redirect because the app is an installed PWA and a home-screen icon can hold it as a cached start URL indefinitely; deleting the route would open that icon on a 404. The 2,867-line mileage page moved verbatim — no refactor bundled into a move.

**Maintenance inverts the existing forecast rather than computing a second pace.** `lib/maintenance.js`'s `dateAtOdometer()` walks `monthlyForecast()`'s points and interpolates the crossing, so scenarios, travel exclusions and the usual-trips baseline flow into maintenance for free and the two tabs can't disagree about how fast the car is driven. Due = whichever of the mileage/time interval comes first; a due point past the 3-yr horizon reports "after lease end" rather than extrapolating past the lease.

**Checking an item off rolls it forward from the service just logged, not the previous due date** — so servicing late doesn't compress every future interval. `maintenance_records` is append-only, which is why that needs no extra state on the item.

**Where the intervals came from, and the two honest states the source forced.** John supplied a screenshot of the Model 3 Owner's Manual Service Intervals section after `tesla.com` came back 403 from the dev environment's egress proxy (a policy denial, not a timeout — so no parser could be written against observed output; the sync is deferred to PR 2). Transcribing it rather than recalling it corrected three things: the A/C desiccant bag is not on the Model 3 list at all and had been invented; the caliper clean/lube (1 yr **or** 12,500 mi) was missing entirely and is the first real both-intervals item; and **the manual states no number for the brake fluid check** — it renders "every years". That row is stored with null intervals and shows "interval not stated in source", never back-filled from memory. Tire rotation's tread-depth trigger and the caliper's salted-roads condition became `condition_note`: real triggers the app cannot compute, displayed as stated conditions and never turned into a due date. The caliper item seeds **inactive** with a toggle rather than inferring where John drives.

**Provenance is a column, not a comment.** `source` is `official` / `starter` / `manual`, never inferred; editing an interval re-sources the row to `manual`, because the stored value is no longer what the manufacturer published.

**Two bugs caught by doing rather than reading.** (1) The Car tab bar was written in `var(--font-display)`, but `app/layout.jsx` loads Fraunces with `style: ['italic']` only — upright display text would have silently fallen back to serif. Found while matching fonts for the UI mockup; now the sans stack. (2) The "due soon" window was set to 30 days without thought; a test expectation failure exposed that these intervals run a year or two, so 30 days left no time to book anything. Now 60 days (`SOON_DAYS`), with `SOON_MILES` at 500.

**Home is deliberately insulated from the deploy-before-migrate window.** `/api/home-summary` reads the maintenance tables in a guarded helper **outside** its main `Promise.all`. Inside the batch, a missing `maintenance_items` between merge and the hand-run `npm run migrate` would 500 the whole route and blank all six domain cards — exactly the PR #29 outage. The Car card simply shows no maintenance line until the tables exist.

Scope artifact: https://claude.ai/code/artifact/bef0cbe6-6b31-4453-9fd0-dd9a3e5e9897 · in-module UI: https://claude.ai/code/artifact/34fa8a09-a419-4243-b48c-cfac480484f1

## 2026-08-26 — Tesla lease mileage calculator scoped (grill session — no code yet)

John: leasing a Tesla Model 3, 10k miles/year allowance, wants to track actual mileage against the lease and forecast whether he'll come in under/over by the 1yr/2yr/3yr checkpoints. Scoped per the project's scope-before-build convention (same pattern as the 2026-08-08 PTO session below) — every open question resolved with John via `AskUserQuestion` before writing this entry. **Nothing built this session** — this is the spec for the build session.

**A new 7th domain — `/mileage`, own Home card.** Unlike PTO (small, Travel-coupled, no new route), this is its own thing: no natural host among the existing six domains, its own data model, its own map UI. New route + nav entry + `DOMAIN_META` color, following the same `useResource`-wired page pattern as every other domain (Travel/Schedules/Ideas/Email all migrated 2026-07-17 — see CLAUDE.md §7's refresh-signal rule).

**The ground truth is odometer readings, not summed trips.** John enters a **starting odometer reading** at lease signing, then periodically logs a dated **actual odometer reading** as time passes — that's the authoritative cumulative-miles curve, same "you tell it the real number" discipline as PTO's manual entries. Point-to-point trip logs (below) are a supplementary journal for context/detail, never the source of the cumulative total — two odometer readings can disagree with the sum of logged trips in between (errands not logged, etc.) and the odometer always wins.

**Lease setup (`mileage_settings`, singleton):** `lease_start_date`, `lease_term_months`, `annual_allowance_miles` (default 10,000), `overage_rate_cents_per_mile`, `starting_odometer`. The 1yr/2yr/3yr checkpoints are computed dates from `lease_start_date`, not calendar-year boundaries (mirrors PTO's own careful date math, just anchored differently — lease-year, not Jan 1). Allowance for a checkpoint = `annual_allowance_miles × elapsed_years`; overage cost is real math (`(projected_miles − allowance) × overage_rate`) only ever computed from these John-entered numbers, per the app's no-fabricated-metrics rule.

**Maps: point-to-point trips log real driving distance, geocoded + routed, not typed by hand.** John picks a start and end location (place-name text, same free-text-then-geocode pattern as Travel's `lib/geocode.js`); the server resolves both to coordinates via the existing Nominatim geocoder and gets driving distance from a **free routing API — the public OSRM demo server (`router.project-osrm.org`), no key, no paid tile provider** — consistent with the explicit "do not add a paid map-tile provider" rule already in CLAUDE.md for Travel's world map. Each trip (`mileage_trips`: origin, destination, lat/lngs, date, computed miles, notes) is a dated log entry John can browse — a small map (reusing Travel's existing static equirectangular world-path component, not a new tile-based map) can plot recent trip endpoints, same no-paid-tiles discipline. Distance is looked up once per trip, cached on the row — never recomputed per page load (same one-lookup-per-change discipline as every other geocode/photo/AI-brief cache in this app).

**Forecasting: baseline pace + selectable named scenarios (John's explicit design call).** Two layers, never blended into a false single "the" forecast without John's say:

1. **Baseline** — `(latest odometer reading − starting_odometer) / days_elapsed_since_lease_start` gives a miles/day pace, projected forward linearly to each checkpoint. This is the always-on default when nothing else is selected — the plain average John asked for ("averaging miles for future periods where there is no specific forecasting scenario").
2. **Named scenarios** (`mileage_scenarios`) — John creates scenarios like "road trip to visit family, +900mi in December" or "new commute starting March, +40mi/week" (a mileage delta tied to a future date or date range, same shape as PTO's saved named scenarios). **John explicitly picks which scenarios are active/included** when viewing a forecast — a checkbox per scenario, not an always-applied stack. The forecast for each checkpoint = baseline projection + the sum of every **checked** scenario's mileage impact that falls before that checkpoint's date. Unchecked scenarios contribute nothing — they're saved options, not automatic additions. Every scenario-adjusted number renders visibly labeled ("+ 2 scenarios applied"), never silently merged into what looks like the plain baseline — same "would leave X" honesty convention as PTO's simulation layer.

**No AI.** Pure date/mileage math (`lib/mileage.js`, mirroring `lib/pto.js`'s pattern — DB-free, imported both server- and client-side so the math is never duplicated) + CRUD + two free, keyless external lookups (Nominatim geocode, OSRM route) — no model call anywhere, consistent with the app's AI-minimal defaults.

**Build sketch (next session):** new migration — `mileage_settings` (singleton), `mileage_readings` (dated odometer log), `mileage_trips` (point-to-point log with cached geocode + routed distance), `mileage_scenarios` (named date-tied mileage deltas). `lib/mileage.js` (pace calc, checkpoint projection, scenario blending — pure), `lib/route-distance.js` (OSRM lookup, mirrors `lib/geocode.js`'s fail-soft shape — a failed route lookup just leaves that trip's miles blank for John to fill in by hand, never a broken save). `route()`-wrapped `/api/mileage/*` CRUD (settings, readings, trips, scenarios) + a computed-forecast endpoint; `useResource`-wired `/mileage` page (odometer log entry, trip log + mini map, checkpoint cards showing baseline vs scenario-adjusted projections with the scenario checkboxes, settings form). Home gains a new Mileage card (`DomainGrid.jsx` + `home-summary`) showing current pace vs allowance — real data only, same discipline as every other Home tile. Update `CLAUDE.md` §1/§3/§5/§7 and `ARCHITECTURE.md`'s domain table once built, same as every prior domain build.

---

## 2026-08-26 (cont'd 5) — Mileage: address autocomplete + validation on Favorite places

John's follow-up on the favorite-places feature: "The real address doesn't have a drop down? I feel like it should, similar to how websites try to complete the address and give you options when you type an also validate the address." The address field was plain free text with no feedback on whether it would actually geocode.

No new schema (`mileage_places.lat`/`lng` already existed from migration 020). Added `searchPlaces(query, limit)` to `lib/geocode.js` — the same Nominatim `/search` endpoint `geocodeQueryResult` already used, but `limit` isn't hardcoded to 1, so it returns a pick-list instead of silently taking the first match. New route `app/api/mileage/geocode-suggest/route.js` proxies it (the browser can't call Nominatim directly per CLAUDE.md §2); it's deliberately uncached, unlike every other geocode call in this app, since a keystroke-driven suggestion list isn't the "one lookup per change" pattern the rest of Mileage follows. `AddPlaceForm` debounces the address input (350ms, 3-char minimum) and shows the returned suggestions in a dropdown; picking one fills the address text and carries validated `lat`/`lng` straight into the save payload. `POST /api/mileage/places` now accepts optional `lat`/`lng` and trusts them instead of re-geocoding when present — a picked suggestion can't drift to a different result than what was shown. Editing the address text after a pick clears the stored coords, so a stale pick is never silently saved against edited text; a hand-typed address with no pick still saves and geocodes server-side exactly as before. Deliberately Nominatim, not Google Places Autocomplete — same free/keyless-only rule as every other Mileage lookup this session.

**Verified:** `next build` clean, Prettier clean on all touched files.

## 2026-08-26 (cont'd 4) — Mileage: favorite places + leg-based scenarios

Two follow-ups John raised together after using the routes popup: (1) he noticed lookups kept falling back to manual mile entry, and asked if they could be address-based; (2) the scenario planner should let him express "what if I went to the cafe 3x/week instead of 2x" directly, not as a typed mile guess.

**Root cause of (1):** the trip journal and routes popup both default an origin to the literal label "Home" — not a real geocodable place, so every "Home"-anchored lookup silently failed. **Migration 020** adds `mileage_places` (label + address, geocoded and cached once at save time — same one-lookup-per-change discipline as everywhere else). `lib/route-distance.js`'s `fetchDrivingDistanceMiles` gained an optional `placesByLabel` map, checked before geocoding a bare label; `loadPlacesByLabel(sql)` builds it. Both `mileage_trips` and `mileage_usual_legs` POST routes now load places and pass them through. New "Favorite places" button + popup on `/mileage` (add/delete, same popup chrome as the routes popup) and a shared `<datalist id="mileage-places">` on every origin/destination input, so typing "Gym" suggests a saved label without forcing a rigid picker.

**Feature (2): leg-based scenarios.** **Migration 021** adds `leg_id`/`new_times_per_week` to `mileage_scenarios`. `lib/mileage.js`'s new `legFrequencyScenarioImpacts()` computes `impact_1yr/2yr/3yr` from a leg's miles × the frequency delta, extrapolated linearly from lease start to each checkpoint — the same model the pace baseline already uses, so a leg-based scenario's numbers sit on the same footing as everything else on the page. `projectCheckpoint()` itself is untouched: a leg-based scenario is still just a row with `impact_1yr/2yr/3yr`, computed server-side (never trusted from the client) rather than typed. `AddScenarioForm` gained a Manual/From-a-route toggle; picking a route + a new ×/week shows a live preview before saving. Toggling a scenario's `active` flag alone never triggers a recompute (only a body carrying `new_times_per_week` does), so the existing include/exclude behavior is unchanged.

**Verified:** `next build` clean (caught and fixed a real gap in review: the first pass added the `mileage_places` query but never wired `places` into `/api/mileage`'s `loadAll()` return or the `GET` response — found before shipping, not after), Prettier clean on all touched files, `/mileage` rendered against a dev server with no live Neon in this sandbox — no crash. **Run `npm run migrate`** (migrations 020 and 021) after merge.

## 2026-08-26 (cont'd 3) — Mileage: "usual trips" detail popup (named routes)

John wanted a way to build the "usual trips" rate from real named routes ("Home from gym, etc.") instead of guessing one aggregate number, with a button opening a detail popup — and mentioned Google Maps for computing each leg's miles.

**Went with the existing free geocode + OSRM lookup instead of Google Maps**, deliberately — CLAUDE.md already rules out a paid map-tile provider for this app (Travel's world map, and the mileage trip journal built two sessions ago on the same principle), and Google Maps' Directions/Distance Matrix APIs require a billing-enabled key. The trip journal's exact lookup mechanism (`lib/route-distance.js`) already does precisely this job — geocode both ends, ask OSRM for the driving distance — so the popup reuses it rather than adding a second, paid way to do the same thing.

**Migration 019** — `mileage_usual_legs` (origin, destination, miles, `times_per_week`, notes). A new "Build from routes" button on the Usual Trips panel opens `UsualLegsPopup`: add a route (auto-looked-up miles, or typed by hand), see each leg's weekly contribution, and a running total (`lib/mileage.js`'s new pure `usualLegsWeeklyTotal`). Legs are a **breakdown, not a second baseline** — "Use this total" is the only thing that writes to `mileage_settings.usual_miles`/`usual_period` (always applied as a weekly figure), same explicit-apply discipline as every other "simulation feeds the real number only on confirm" pattern in this app (PTO's saved scenarios, the AI import previews). `/api/mileage/usual-legs` (POST) and `.../[id]` (DELETE); the main `/api/mileage` GET now also returns `usualLegs`.

**Verified:** `next build` clean, Prettier clean on all touched files, `/mileage` rendered against a dev server with no live Neon in this sandbox — no crash. **Run `npm run migrate`** (migration 019) after merge.

## 2026-08-26 (cont'd 2) — Mileage: "usual trips" baseline override

John asked for a checkable "usual trips" section (a routine mi/day, mi/week, or mi/month rate via a dropdown) that, when checked, replaces the logged-pace baseline for every checkpoint's forecast — scenarios still add on top either way; unchecked, the checkpoints use the existing logged pace + scenarios exactly as before.

**Migration 018** — `mileage_settings` gains `usual_miles` (nullable numeric), `usual_period` (`day`/`week`/`month`, default `week`), `usual_active` (boolean, default false). `lib/mileage.js` converts the rate to a daily pace (`usualPaceMilesPerDay`, using the Gregorian month average for `month` so it isn't off by a day or two across a multi-year lease) and `mileageSummary()` picks whichever pace feeds `projectCheckpoint()`'s baseline based on `usual_active` — a one-line branch, since the checkpoint math itself was already pace-parametric from the original build. The logged pace (`pace`) is still always returned for display, even when "usual trips" is the active baseline, so switching the toggle never hides real data, just changes which number drives the forecast.

**UI:** a new `UsualTripsPanel` on `/mileage`, between the checkpoint cards and the current-pace/scenarios row — a miles input + period dropdown + Save, and a separate checkbox that PATCHes `usual_active` immediately (same auto-save-on-toggle pattern as the scenario `active` checkboxes). A legend line under the form states plainly which baseline is currently in effect and its mi/day equivalent, so the checkpoint cards above are never left unexplained. `home-summary`'s Mileage card needed no route change — it already selects `SELECT * FROM mileage_settings` and calls the same `mileageSummary()`, so the new columns flow through automatically.

**Verified:** `next build` clean, Prettier clean on all touched JS/CSS, `/mileage` rendered against a dev server with no live Neon in this sandbox (same limitation as the original build) — no crash, fails soft to the loading state. **Run `npm run migrate`** (migration 018) after merge, same as 017.

## 2026-08-26 (cont'd) — Mileage calculator built (7th domain)

Built to the same-day scoping spec above, after John reviewed mocked-up designs (a Claude Design canvas: the `/mileage` page, the Home card, the trip-logging flow, and the sidebar/dashboard icon placement — including a follow-up pass adding the diagonal domain-hue tint to the Home card to match the other six) and said "build please."

**Migration 017** (`mileage_settings`, `mileage_readings`, `mileage_trips`, `mileage_scenarios`). Lease fields on `mileage_settings` are nullable — no seeded fake lease — so a fresh install renders an honest "set up your lease" state (mirrors Language's "Calendar not connected" pattern) until John fills in the real start date, term, starting odometer, allowance, and overage rate.

**`lib/mileage.js`** — pure, DB-free math (pace from the odometer log, three checkpoint projections, scenario blending), the same shape as `lib/pto.js`, imported both server-side (`/api/mileage*`) and client-side (`app/mileage/page.jsx`) so the math is never duplicated. `lib/route-distance.js` adds real driving-distance lookups for the trip journal: geocodes both ends via the existing `lib/geocode.js` Nominatim helper, then queries the free, keyless OSRM demo routing server — same no-paid-map-provider discipline CLAUDE.md already holds Travel's world map to. A failed lookup just means the save is refused with a message to enter miles by hand, never a broken page.

**Routes:** `/api/mileage` (GET the full computed view — settings, readings, trips, scenarios, pace, checkpoints — PATCH settings), `/api/mileage/readings` (POST, upserts by date), `/api/mileage/trips` (POST, runs the OSRM lookup), `/api/mileage/scenarios` (POST/PATCH/DELETE — PATCH covers both editing a scenario and toggling its `active` flag). All `route()`-wrapped per CLAUDE.md §7's CRUD-route error convention. `home-summary` gained a `mileage` block (configured flag, pace, latest odometer, the 1-year checkpoint) computed the same DB-local way as the PTO line — no external calls on a Home load.

**UI:** `app/mileage/page.jsx` — checkpoint cards (1/2/3-yr, honest "log a reading to forecast" when pace is null rather than a fake zero), a current-pace panel with the odometer log + add-reading form, a scenario panel where checking/unchecking a saved scenario changes which checkpoints include its mileage impact, and a trip-journal panel with an add-trip form that calls the OSRM-backed route. Optimistic local-state mirroring + revert-on-failure + the app-wide `refresh()` signal on every mutation, matching the convention every other migrated page follows. New `MileageIcon` (a speedometer glyph, same 24×24/1.7px stroke construction as every other icon) in `components/icons.jsx`, a `mileage` entry in `components/domain-meta.js`, a `--dom-mileage` token pair (light `#0e93b4` / dark `#3fd0f2`) in `app/globals.css`, a Sidebar nav entry placed right after Travel (both mobility-related — the mocked-up placement John approved), and a 7th `DomainGrid` card with its own diagonal cyan→blue hue tint (`cardMileage`), matching the mockup exactly including the "N cards in a 3-col grid leaves the last row partial" honest layout note.

**Verified:** `next build` clean (all `/api/mileage*` routes + `/mileage` compiled), Prettier clean on every new/touched file, `/mileage` rendered headlessly against a dev server with no live Neon in this sandbox (same limitation as every prior domain build) — confirmed it fails soft to the loading state rather than crashing; the DB error was the expected "no `DATABASE_URL`" message, not a code bug. **Not verified live** against real Neon/OSRM/Nominatim — first real exercise happens once John runs `npm run migrate` (migration 017) and opens the deployed `/mileage` page.

## 2026-08-26 — Tesla lease mileage calculator: mocked up before building

Per John's ask ("can you mock some designs for that module?"), published a Claude Design canvas (not code) covering the `/mileage` page (checkpoint cards, current-pace panel with a live add-reading form, a scenario checklist that recalculates the forecast on toggle, and a trip log), the Home domain-grid card, the trip-logging flow with a mocked route lookup, and — after a follow-up ask — the sidebar nav icon in context (with a swatch panel showing the glyph at every size it's used) and the full "At a glance" grid showing where the 7th card lands. A second follow-up added the diagonal hue-tint treatment to the standalone Home card to match the other six. John approved and asked to build it as-is; see the build entry above for what shipped. No code changed in this session — pure design-canvas work per the `design` skill's own scope.

## 2026-08-09 (cont'd 3) — App-wide AI Assistant (sixth AI use — the agentic one, on Sonnet)

John: "add almost an AI Assistant component to the entire app… it should use the Anthropic key and be able to do anything the user can do manually." Built as a floating chat panel on every page (`components/AssistantPanel.jsx`, mounted in `AppShell` next to the SW registration) → `POST /api/assistant` → `lib/assistant.js`, a Claude Sonnet (`claude-sonnet-5`) tool-use loop (max 10 tool rounds per message, `maxDuration = 300`).

**The core design call: the assistant's tools ARE the app's own api routes.** Each of the ~35 tools is an explicit allowlisted catalog entry mapping to one existing endpoint, executed by same-origin fetch — so "do anything the user can do" is literal: a trip the assistant creates goes through the same geocode + Unsplash + validation path as the Add Trip form, a PTO entry hits the same banked-ledger refusal, and the Gmail boundary holds structurally (the only Gmail tool is the read-only proxy; hide rules and email to-dos are the same local-flag routes the UI uses — no Gmail write endpoint exists for a tool to reach). No duplicated business logic, no second validation layer to drift.

Scope of the v1 catalog: home summary, trips CRUD + travel stats, the full PTO planner (budget, holidays, entries; scenarios deliberately left out of v1), ideas CRUD, schedules CRUD, projects (overview + add/manual-layer/remove), email (inbox, rules, to-dos), calendar events + next tutor call, language notes + French progress. Left out on purpose: the AI-import preview flows (travel/French/schedules screenshots — they're built around John reviewing a preview UI, which a chat turn can't honor) and hero/brief cache surfaces.

Model: **Sonnet, not Haiku — a deliberate divergence from the app's Haiku-only rule**, documented in CLAUDE.md §7. The five narrow uses stay pinned to Haiku; an agentic assistant juggling a 35-tool catalog is a different shape of problem. (Built on Opus first; John switched it to `claude-sonnet-5` the same day — Opus is too expensive for this.) `ASSISTANT_MODEL` is one constant if the cost/quality tradeoff should change. The system prompt (cached via `cache_control`) carries the app's house rules: Gmail read-only, ideas-vs-schedules boundary = due date, confirm-before-delete, never fabricate data. Bumped `@anthropic-ai/sdk` 0.30 → 0.116 (the 0.30-era SDK predates prompt-caching GA; `messages.create` call sites unchanged).

Client keeps two histories: the raw Anthropic block conversation (resent verbatim each turn, so tool_use/tool_result/thinking blocks stay intact) and the readable transcript with per-turn action chips ("Created a trip", "Updated the PTO budget" — red when the route refused). Any successful write fires the existing app-wide `refresh()` signal, so whatever page is open re-fetches — the same path as the TopBar button. Conversation state is tab-local only; nothing persisted. History resent to the server is trimmed to the last ~60 messages, cut only at a plain user turn so a tool_use is never split from its result.

Verified: `next build` clean, Prettier clean on all new/changed files, no migration (the assistant owns no tables).

## 2026-08-08 (cont'd) — PTO planner built

Built to `PTO_BUILD_PLAN.md` exactly as scoped in the same-day grill session below — no decisions re-opened. Migration 016 (`pto_settings`, `pto_holidays`, `pto_entries`, `pto_scenarios`, plus `trips.pto_days_override`/`pto_exempt`), seeded with CrossCountry's 2026 firm holidays. A pure `lib/pto.js` (no DB access) holds every date computation — weekday/holiday counting, year clamping, taken/planned split, override/exempt precedence, the banked ledger, and scenario costing — and is imported both server-side (`/api/pto/*`) and client-side (the sandbox calculator and saved-scenario costs in `PtoPanel.jsx`), so the math is never duplicated. `/api/pto` returns the whole panel's data in one round trip (real ledger + banked ledger + per-trip breakdown + dated-wishlist sim rows + holidays/entries/scenarios); separate CRUD routes cover holidays, manual entries (refuses an over-drawn banked spend), and scenarios. `app/api/trips/[id]` gained the two override fields on its PATCH allow-list; `home-summary` gained `pto.left`, computed via the same shared math (DB-local, no external calls, consistent with Home's no-fabricated-metrics rule). UI: a new `PtoPanel` on `/travel` (year switcher for the current year + 2 ahead, editable budget, per-trip override/exempt controls, manual entries, a holidays popup mirroring the existing Hidden/Renamed popup pattern, and a visually distinct "Planning (simulation)" sub-section always phrased "would leave X") plus one "N PTO left" line on Home's existing Travel card — no new route, no new Home card, per the scoping decision. **`npm run migrate` applied via the Neon MCP right after merge (2026-08-08)** — confirmed `pto_settings` (budget 25), 9 seeded holidays, and both new `trips` columns on the live DB.

## 2026-08-09 (cont'd 2) — The Google refresh token is dead (`invalid_grant`) + honest scan errors + collapsible PTO panel

Scan Gmail still returned "No new trips found" after the allowlist fix. The logging added earlier finally named it: **every** Gmail call fails with `invalid_grant` from `https://oauth2.googleapis.com/token` — `GOOGLE_REFRESH_TOKEN` is expired or revoked, so the scan never reaches Gmail at all. **Blocked on John:** the token must be re-minted and set in Vercel for **both Production and Preview** (CLAUDE.md §4). Most likely cause — the Google Cloud OAuth consent screen is still in **Testing** mode, where refresh tokens expire after 7 days; the timeline fits exactly (token provisioned 2026-07-14, last successful scan 2026-07-15, silence since). Publishing the consent screen to Production before re-minting would stop it recurring weekly.

**Fixed a regression this exposed (mine, from the allowlist pass).** `listIds` caught every failure and returned `[]`, which turned a total auth failure into a confident "No new trips found" — precisely the dishonest-empty-state this app forbids, and worse than the opaque 502 it replaced. `listIds` now reports `{ids, failed, authFailed}`; an auth failure anywhere (it's a global credential problem, not one brand's hiccup) returns `error: 'gmail_auth'`, and a failed _primary_ query returns `error: 'gmail_unavailable'`. A single brand's transient error is still logged and skipped without sinking the scan. `/travel` renders these distinctly — "Gmail access has expired — reconnect Google (refresh token) to scan." — instead of a false all-clear.

**PTO panel is now collapsible** (John's ask). The title row is the toggle (`aria-expanded`/`aria-controls`, focus-visible ring, chevron rotation that respects `prefers-reduced-motion`); the open/closed choice persists in `localStorage`, read in an effect rather than the state initializer so SSR and first client render agree. **Collapsed, the header still carries "X left · Y taken · Z planned"** — a panel that hides its own answer when closed would just be a thing to re-open.

**Open question for John, not silently changed:** with the token dead, `/calendar` and the Email card also render empty ("0 Events today", "—") rather than "can't reach Google", because CLAUDE.md §7's external-source convention says those routes fail soft. That convention is right for a missing optional token, but it currently can't distinguish "nothing there" from "auth is broken". Worth deciding whether fail-soft routes should carry an `error` flag the UI can show.

Verified: `next build` clean, Prettier passes, no migration.

---

## 2026-08-09 (cont'd) — Fix: Scan Gmail couldn't see cruise bookings at all (promotions-stream blind spot)

John: "Scan Gmail says no new trips found, but there is a Celebrity trip in December 2026." Searched his mailbox directly via the Gmail MCP and found the booking — **Celebrity Beyond, sails Dec 20, 2026, 7-night St. Kitts & Perfect Day holiday cruise, Booking #4655111** — then traced why the scan is structurally blind to it.

**Root cause: no booking-confirmation email for this cruise exists in the mailbox at all.** The only evidence is Celebrity's own _marketing_ emails, each carrying a real reservation block ("We look forward to seeing you on board Celebrity Beyond on December 20, 2026 for your 7 Night St. Kitts, & Perfect Day Holiday Cruise" + Booking #). Gmail files those under `category:promotions`, which `lookbackQuery()` excludes by design. Proved against the live mailbox: the scan's exact query returns **0** Celebrity threads; the same query minus `-category:promotions` returns **19**. The exclusion isn't wrong — it's what keeps the 30-day candidate set at ~50 instead of ~200 — so the fix is an allowlist, not its removal (John's call between the two options).

**Fixed, in four parts** (all three were required — any one alone still fails):

1. **Travel-sender allowlist pass.** A second search runs per brand in `TRAVEL_SENDER_DOMAINS` (cruise lines, airlines, hotels, OTAs) with the same high-precision keywords but _no_ category exclusion. Brand queries run concurrently, capped at `MAX_PER_TRAVEL_SENDER = 3` each, and the pool gets **reserved slots** (`MAX_TRAVEL_CANDIDATES = 15`) taken out of the budget _before_ the primary pass fills the rest — otherwise a full primary result set would squeeze the new pass straight back out. Total candidates still capped at 40, so per-scan Haiku cost is unchanged.
2. **Duplicate suppression, now against suggestions too.** `matchesExistingTrip` → `matchesKnownTrip`, matching against real trips **plus every prior suggestion** (pending/approved/**dismissed**) plus anything created earlier in the same run. This became load-bearing: one cruise is echoed by ~37 marketing emails in 30 days, each a distinct Gmail id, so the `source_gmail_id` key alone would have filed the same sailing dozens of times — and a dismissed trip would return every week. (A mild version already existed in the data: "Morehead" was suggested twice, once from a Fwd.)
3. **Haiku prompt (the veto).** `lib/trip-detect.js` explicitly instructed the model to set `is_trip=false` for marketing — which would have rejected this email even once the query found it. It now distinguishes _"an ad for trips you could book"_ (still false) from _"an ad wrapping a reservation block for a departure you have already booked"_ (true — extract it, ignore the advertising), and is told to derive `end_date` from a stated start date + stated length ("7 Night" → Dec 27), which is arithmetic on stated facts rather than invention.
4. **Body extraction.** These reservation blocks sit at the _bottom_ of enormous marketing HTML — measured at char 10,233 of 13,509 in the real email, only 15% inside the shared 12k cap, so a slightly longer sibling would silently clip it. The scan now reads 20k, and `stripHtml` decodes numeric/zero-width entities (Celebrity renders the sail date as `on &zwnj;December 20, 2026&zwnj;`) so the model sees clean text.

Also raised the detection loop to 4-way concurrency, so the larger candidate pool still finishes inside the new 60s budget.

**Verified:** the query claim, sender categories, and per-brand volume measured against the live mailbox via MCP; the real email pushed through the actual `extractPlainText` (sail date survives, entities gone, block renders clean); dedupe exercised for first-hit/repeat/reworded/dismissed/unrelated; budget reservation checked against a saturated primary set. `next build` clean, Prettier passes, no migration. **Not verified live:** the Haiku classification itself — no `ANTHROPIC_API_KEY` in this sandbox — so the first real proof is John clicking Scan Gmail on the deployed app.

---

## 2026-08-09 — Fix: PTO panel's No PTO / override toggle never persisted (jsonb array write bug)

First real-use report after the PTO build shipped: John toggled "No PTO" on two trips, the checkboxes stayed checked, but the headline kept counting all four trips — and the DB confirmed `pto_exempt` was still `false` everywhere. Two stacked bugs:

- **Server (root cause):** `app/api/trips/[id]`'s PATCH, when the body doesn't include `itinerary`, wrote back `existing.itinerary` as a raw JS array. The Neon driver serializes an array param as a **Postgres array literal, not JSON** (verified by capturing the driver's wire payload), which a `jsonb` column rejects (`invalid input syntax for type json`) — so every minimal PATCH on a trip with an itinerary 500'd. Latent since the itinerary feature: the trip-detail editor always sends `body.itinerary` (hitting the `JSON.stringify` path), so nothing minimal ever PATCHed an itinerary-bearing trip until the PTO panel's `{pto_exempt}` toggles. Fix: re-stringify `existing.itinerary` on the untouched path.
- **Client (why it looked half-saved):** `PtoPanel.saveTrip`'s optimistic update patched DB field names (`pto_exempt`) onto rows whose view shape uses `exempt`/`override`, so `TripRow`'s props never changed — its local checkbox state neither confirmed nor reverted, leaving stale optimistic UI after the failed persist (exactly the revert-on-failure convention this app requires). Fix: map the patch to view fields so success propagates and `setTrips(prev)` visibly reverts.
- **Also:** the row's cryptic `auto 2` label (John couldn't read it) is now "2 days (auto)" / "5 days · auto would be 9" (override) / "not counted" (exempt).

Verified: driver serialization bug reproduced in isolation (wire capture) + the bad literal rejected by live Postgres; `next build` clean; Prettier passes. No migration.

---

## 2026-08-08 — PTO planner scoped (grill session — no code yet)

Scoping session per the project's scope-before-build convention; every open question from the Future Domain Ideas entry resolved with John. **Nothing built this session** — this entry is the spec for the build session.

**The core job (root decision):** answer "how many days do I have left?" — a live balance, not a scenario-planning engine and not just a history log.

**The model — a self-set budget, not employer accrual.** CrossCountry's PTO is **unlimited** with a "20–25 days/year" guideline, so there is no employer balance to track or accrue — the only honest number is John's own target. Decisions: annual budget = **25 days**, resetting on the **calendar year** (Jan 1, use-it-or-lose-it framing). Headline = budget minus days logged, with the split visible: **"X left · Y taken · Z planned"** (planned = future logged days; both net against the balance). The budget is stored as John's editable number — explicitly his target, never presented as an employer-provided balance (the no-fabricated-data rule).

**The log — auto-derived from trips, with overrides; manual entries for the rest.**

- A real trip (status `upcoming`/`past`; **wishlist excluded**) in the current PTO year auto-counts its **weekdays minus firm holidays** as PTO days. Past trip days = taken; future trip days = planned.
- **Per-trip editable override** (John's pick over exclude-only or pure-auto): each trip shows its auto-computed PTO days; John can override the number (worked remotely part of a trip) or mark a trip as consuming no PTO. An override **sticks — auto never overwrites it** (same discipline as `image_source = 'manual'`).
- **Standalone manual entries** exist for non-trip PTO days, but are expected to be rare — John's appointments generally don't consume PTO (he takes part of the day and makes the hours up), so no partial-day/hours modeling in v1. Whole days only.

**Firm holidays — a table, editable in-app.** Seeded with CrossCountry's 2026 list (9 days, from John): New Year's Day (Jan 1), MLK Day (Jan 19), Memorial Day (May 25), Juneteenth (Jun 19), Independence Day (Jul 4 falls on a Saturday in 2026 — seeded as the observed Fri Jul 3; John later confirmed the firm's convention: Saturday holidays observe the prior Friday, Sunday holidays the following Monday, so holidays are always stored as their observed weekday date), Labor Day (Sep 7), Thanksgiving (Nov 26), Day after Thanksgiving (Nov 27), Christmas Day (Dec 25). A small in-app editor lets John add each new year's dates himself (with the fallback that he can always hand a list to a Claude session).

**Banked holidays — a second, separate ledger (added same session).** If John works a firm holiday, he banks it and can take that day later. Decisions: (1) **separate counter** — the PTO headline stays "X left · taken · planned" and a distinct small stat shows "N holidays banked"; the two ledgers never mix into one number. (2) **Use-it-or-lose-it, same year** — banked holidays reset Jan 1 with the PTO year. (3) **Spending is a manual offset — no auto-offsetting** (John's revision, same session): a spent banked day is simply its own dated entry, and if it happens to fall inside a trip's range the trip math ignores it — John adjusts that trip's PTO override himself when he wants the overlap reflected. The two ledgers never touch each other automatically. Mechanics: the holiday row itself carries a "worked" toggle in the holidays editor (worked → +1 banked), and spending is an entry type alongside manual PTO days. Banked = holidays marked worked − banked-spend entries, floor 0 (spending can't be logged past what's banked).

**Simulation — planning scenarios on top of the real ledger (added same session).** Beyond tracking, John wants to simulate: the real balance stays strictly taken + planned, and three what-if surfaces sit on top, none of which ever touches the real numbers — every simulated figure renders as "would leave X", visually distinct from the real balance. (1) **Wishlist what-if:** a dated wishlist trip appears as a scenario row — "would cost N days → balance would drop to X" (undated wishlist trips can't be simulated and just say so); promoting wishlist → upcoming is the existing flow that makes it real. (2) **Quick sandbox calculator:** type any date range → its weekday-minus-holiday cost and resulting balance; nothing saved. (3) **Saved named scenarios:** a scenario ("Plan A: Japan + Christmas") is a named set of items — wishlist-trip references and/or ad-hoc date ranges — with costs computed live against the chosen year, never stored. Plus a **year switcher** spanning the current year **plus two ahead** (2026 → 2028 while in 2026 — John wants to plan up to two years out): same math against that year's fresh budget (the same editable annual number), that year's holidays (empty until John enters them, stated honestly in the UI), and trips/wishlist/scenario items dated in that year.

**Placement:** a **PTO section on `/travel`** (near the Stats bar) — the feature is small and tightly Travel-coupled, so no 7th domain/route. Home's existing **Travel card gains one PTO line** (e.g. "12 PTO left") via `home-summary`. No new Home card.

**No AI.** Pure date math + CRUD — nothing here needs a model, per the app's AI-minimal defaults.

**Build sketch (next session):** migration 016 — `pto_settings` (or a per-year budget row), `pto_entries` (manual whole-day entries, with a `kind` distinguishing PTO days from banked-holiday spends), `pto_holidays` (with a `worked` flag feeding the banked counter), `pto_scenarios` (named item sets for saved simulations), plus `trips.pto_days_override` / `trips.pto_exempt`; a pure `lib/pto.js` (weekday/holiday math + summary), `route()`-wrapped `/api/pto` CRUD + a computed summary consumed by `/travel` and `home-summary`; `useResource`-wired so the TopBar refresh covers it. Run `npm run migrate` after merge, as always (CLAUDE.md §6).

---

## 2026-07-21 — Travel Stats bar (the honest four tiles)

First of the "reserved" Design/UX backlog items to ship. Scoped with John before building (per the scope-before-build convention): with build-ready work exhausted, he picked the Travel Stats bar and chose the **full 4-tile, whole-log** shape.

- **Four tiles, all real trip data** (CLAUDE.md's no-fabricated-metrics rule): **Trips** (count of real trips), **Nights** (sum of `end_date − start_date`), **Countries** (distinct), **Cruise nights** (nights on cruise trips). "Real trips" = status `upcoming` or `past`; **wishlist is excluded** from every tile (aspirational, not travel that happened/is booked). Framing is whole-log, not past-only — John's call.
- **Points/miles deliberately omitted.** The mock wanted them, but they imply a loyalty-account integration with no data source today — leaving them out (rather than inventing totals) is the same honest-data discipline as everywhere else. Noted in the backlog as still reserved.
- **Countries is reverse-geocoded, not guessed.** The destination is free text with no country in it ("Denver", "Cebu"), but every trip already caches map coords — so `lib/geocode.js` gained `reverseGeocodeCountry()` (Nominatim reverse endpoint, `zoom=3`) and each trip's country is resolved **from its coords**, cached on new columns (`country`/`country_code`/`country_geocoded_at`, migration 015). Same one-lookup-per-trip, never-per-load discipline as the forward geocode and the trip photo.
- **Backfill is lazy + fail-soft.** New `/api/travel-stats` (external-source shape — zeroed stats on any error, never a broken page) computes the tiles via a pure `lib/travel-stats.js` and, on the way, reverse-geocodes any real trip that has coords but no country yet (capped per pass for Nominatim's ≤1 req/s policy, the attempt stamped so an unresolvable/mid-ocean trip isn't retried every load — mirrors the trip-map coord backfill). Cruise detection is a transparent `\bcruise\b` match on destination/notes, not a stored flag. A destination change in the trips PATCH resets the cached country so it re-derives.
- **Wiring:** the Travel page renders `<StatsBar>` above the brief/hero row, fed by `useResource('/api/travel-stats')` so the TopBar refresh covers it. Front-end + one new route + one new lib + migration 015. **Run `npm run migrate` after merge** before relying on the Countries tile.

_Also this session: confirmed migrations 012/013/014 were already applied to the live Neon DB and checked off their stale "run migrate" to-dos._

## 2026-07-19 (cont'd 9) — Schedules: AI screenshot import (John's call — the app's fifth distinct AI use)

John wanted to add tasks from a screenshot (a text message, a to-do list app, a note, anything with an actionable item) instead of retyping each one by hand. New `lib/schedule-import.js` (Haiku vision) reads a screenshot and returns candidate `{title, due_date, notes}` tasks — resolving relative dates ("tomorrow", "next Friday") against the **server's** clock (not the client's) so a wrong device clock can't skew them, and never inventing a date it can't read/infer. `/api/schedule-import` is preview-only (same shape as French's `/import` route — fails soft, `configured:false` if no key). **Nothing is auto-saved**: John reviews/edits every candidate (title, due date, or removes a row) in a popup, and only the existing `/api/schedules` POST — unchanged, one call per confirmed task — ever creates a row. No new persistence path. Unlike French's import (one known source, one fixed shape), a schedule screenshot's source is arbitrary and may yield zero, one, or several tasks from a single image.

## 2026-07-19 (cont'd 8) — Schedules: edit tasks in place

Schedules had no way to edit a task after creation — only mark done/in-progress or delete. Added an inline edit: a pencil icon on each row (next to delete) swaps that row for the same field set `AddScheduleForm` uses (title, due date, notes, trip/project link), pre-filled from the task, PATCHing the existing row (`/api/schedules/:id`, already supported all these fields — no backend change) instead of creating a new one. Reuses the row's own card chrome rather than nesting another bordered form inside it.

## 2026-07-19 (cont'd 7) — To-do's now includes Schedules tasks (real completion) + fixed stale Up Next after Schedules/Email edits

John reported Schedules tasks weren't flowing into To-do's, and separately that Up Next looked stale after other pages' edits — both traced to the same root cause plus one real gap:

- **The gap:** the To-do's widget only ever showed email-flagged items. `HeroTodos.jsx` now merges two sources — starred emails (`email_todos`) and open Schedules tasks (`schedules.status != 'done'`, already present in the `home-summary` payload) — into one list sorted by date (due date for tasks, flag time for emails), each with a small color-coded dot (schedules = yellow, matching Up Next's domain color; email = gold, matching the star). Checking off a Schedules item does **real completion** — `PATCH /api/schedules/:id { status: 'done' }`, the same endpoint `/schedules`'s own checkbox uses — not just a local dismiss, per John's explicit call.
- **The staleness bug:** confirmed via the live `/api/home-summary` response that the server data was always correct — the actual bug was client-side. `useHomeSummary` caches its fetch at module scope and only re-fetches on the app-wide `refresh()` signal (the TopBar button). `/schedules` (add/update/delete) and `/email` (the star toggle) never fired that signal, so a change made there left Home's Up Next / To-do's showing stale data until a manual refresh — the exact class of bug fixed for `/calendar`'s mutations two entries up, just not yet applied to these two pages. Now all three (`/calendar`, `/schedules`, `/email`) fire `refresh()` after every mutation.

John wanted to rename an event — or a whole recurring series — from `/calendar`, without the change hitting his real Google Calendar. Same read-only boundary as `calendar_hidden` (§2/§7): a new `calendar_renames` table (migration 014) stores a display-title override keyed by either the event's own Google id ("just this event") or its `recurringEventId` ("the whole series" — every expanded occurrence of a recurring event shares that id, since `singleEvents: true` already expands the series into per-occurrence rows with a shared `recurringEventId`). The Calendar-fetch helper (`lib/calendar-events.js`, shared by `/api/calendar-events` and `/api/home-summary` — see the entry below) now also queries `calendar_renames` and substitutes the override title, preferring an occurrence-specific override over a series-level one. New `/api/calendar-renames` (list + upsert) and `/api/calendar-renames/[id]` (revert) routes, `route()`-wrapped. UI: a pencil icon beside the existing hide `×` on every grid chip and list row opens a small modal — pre-filled with the current title, a scope choice ("just this event" / "this and all events in the series") only shown when the event actually has a `recurringEventId`, and a "Revert to original" action when already renamed. A "Renamed (N)" popup in the header mirrors the existing Hidden-events popup for a one-place undo list. **Run `npm run migrate` after merge** (migration 014).

_Follow-ups (same session, same PR):_ (1) hide/rename mutations on `/calendar` now fire the app-wide `refresh()` so the Home "Up next" agenda updates without a manual TopBar refresh (`useHomeSummary` caches at module scope). (2) **Unified the Language next-call lookup onto the shared Calendar fetch.** `lib/tutor-call.js`'s `findCalendarMatch` used to run its own `events.list`, so it bypassed the hide/rename "linking" entirely (a renamed Spanish call still showed its raw Google title like "John Shaw" in Up Next; a hidden one could still surface). It now runs its keyword/organizer match over `fetchCalendarEvents()`'s output, so it inherits hide-filtering and rename-substitution from the one source of truth. Match fields the render shape drops (`description`, `organizerEmail`, `attendeeEmails`) were added to the shared normalized event so the matcher — which IDs a lesson by organizer email, since some are titled just "John Shaw" — still works; matching keys off `originalTitle` (not the renamed title) so renaming a call to something without a Spanish keyword doesn't stop it being recognized.

## 2026-07-19 (cont'd 5) — Up next: Calendar events + per-domain colors

Follow-up to the Calendar redesign below. John asked for three things: (1) confirm the Calendar view's photo backdrop changes with time of day like the Home hero — it already did (same `timeBand()` + `/api/hero-image` call, just not called out); (2) non-hidden Calendar events should feed the Up Next agenda; (3) Schedules items should too (already did, via `lib/agenda.js`'s existing loop — no change needed, just confirmed); (4) each Up Next domain should render in a distinct color (Language green, Travel blue, Schedules yellow, plus a color for the new Calendar source).

- Extracted the Calendar-fetch logic shared by `/api/calendar-events` and (now) `/api/home-summary` into `lib/calendar-events.js` — one place that normalizes events and filters `calendar_hidden` ids, so Home and `/calendar` never disagree about what's hidden.
- `home-summary` now fetches the next 30 days of non-hidden events; `buildAgenda()` (`lib/agenda.js`) merges them in under a new `calendar` domain, deduped against `language.nextCall` by Google event id so a Spanish-tutor Calendar event never double-renders under two domains.
- Added a `calendar` entry to `DOMAIN_META` (icon, `/calendar` href, a new `--dom-calendar` purple CSS var) — used site-wide wherever `DOMAIN_META` is consulted, though today only the Up Next agenda actually renders a `calendar`-domain row.
- The Up Next widget's row accent no longer reads `DOMAIN_META`'s theme-following brand color directly — it's white text over a photo regardless of site theme, so `HeroAgenda.jsx` now has its own fixed `UP_NEXT_ACCENT` map (green/blue/yellow/purple) instead of swapping shades with light/dark mode. Travel's `--dom-travel` (teal) is unchanged everywhere else in the app — this recolor is scoped to the Up Next widget only, not a site-wide Travel rebrand.

No schema/API contract changes beyond the new `calendar` field on `/api/home-summary`'s response — no migration needed.

## 2026-07-19 (cont'd 4) — Calendar: Outlook-style List/Calendar tabs, equal grid, photo backdrop

John reported the month grid's day columns were uneven with Saturday clipped off-screen, wanted the grid and list split into separate tabs instead of both showing at once, and found the view visually flat. The uneven-columns report was a real CSS bug: the grid used `repeat(7, 1fr)`, and `1fr` is really `minmax(min-content, 1fr)` — a long event title (e.g. "Recordatorio Pago Final Crucero DRVCHR") forced its column wider than the rest and pushed the 7th column off the right edge. Fixed with `repeat(7, minmax(0, 1fr))` plus `min-width: 0` + `overflow: hidden` on cells and ellipsis on chip titles, so every square is exactly 1/7 wide and all seven weekdays show. Added an Outlook-style segmented **Calendar / List** tab toggle (List groups the month's events by day). For visual richness, reused the Home hero's already-cached time-of-day Unsplash photo (`/api/hero-image?band=…`) as the page backdrop — no new backend, no per-load fetch, per-band gradient fallback when there's no photo — with both views rendered as frosted-glass panels over it. Front-end only, no migration.

## 2026-07-19 (cont'd 3) — Home hero: side-by-side Up next / To-do's columns

Follow-up to the hero To-do's entry below. John asked what happens as more Up next/To-do's items pile up — the stacked layout didn't scroll or overlap (both lists were hard-capped), but was tight, and Up next had no "+N more" indicator so items past its cap silently didn't show. Split the hero widget into two columns (Up next left, To-do's right) instead of a vertical stack, so each list gets its own row budget; restored Up next's cap to 3 extra rows (had been shrunk to 2 to fit the stack) and gave it the same "+N more" line To-do's already had. Widened the widget to 440px and moved the stack→columns breakpoint from 640px to 900px so the wider two-column widget can't crowd the hero's quote text on a medium/tablet-width viewport before it collapses back to a stack. Front-end only, no migration.

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

## 2026-09-07 — Trip merging: fold booking legs into one real trip

John noticed a real duplication problem: a single journey (departing 12/31/26 through Singapore, then Cebu, then Taiwan, plus a not-yet-booked JFK leg) was landing in `trips` as several separate rows — one per booking confirmation the weekly Gmail scan or a manual add picked up. Left alone, each row counted its own PTO weekdays, its own "upcoming trip," its own Travel Stats nights — silently multiplying one real trip's cost by however many legs it happened to arrive as.

**Design:** row-level merging, deliberately not a rewrite of the itinerary editor's existing per-day "Leg" grouping field (that's a label on days _within_ one trip's own itinerary — unrelated). `trips.merged_into_id` (migration 023, self-referencing FK, `ON DELETE SET NULL`) marks a row as a leg folded into another trip; a leg keeps its own id, itinerary, notes, and budget untouched — merging/unmerging never rewrites a leg's data, it only points/unpoints `merged_into_id`. One level deep by design: a leg can't itself have legs, and can't itself be a merge target — validated in `app/api/trips/[id]/merge`.

**Built:**

- `lib/trip-merge.js` — pure, DB-free module (mirrors `lib/pto.js`/`lib/mileage.js`'s shape): `collapseMergedTrips()` folds every leg into its parent and widens the parent's `start_date`/`end_date` to the merged range (skipping undated legs, so the unbooked JFK leg doesn't break anything until it has real dates), so every existing consumer of a flat trip list keeps working unmodified and just never sees the double-counted legs. `findMergeCandidates()` is the heuristic behind the notification-side prompt below — existing trips within a tight date gap (default 5 days) of an incoming one.
- `app/api/trips/[id]/merge` (POST, `{leg_ids}`) and `app/api/trips/[id]/unmerge` (POST) — the merge/unmerge endpoints, with the one-level-deep validation above. `GET /api/trips/[id]` now also returns `legs` and `parent`.
- **PTO, Travel Stats, and the Home trip count all now collapse before counting** — `app/api/pto/route.js`, `app/api/home-summary/route.js`, and `app/api/travel-stats/route.js` call `collapseMergedTrips()` on their trip rows before doing any date/PTO/stat math, closing the exact duplication John flagged. `lib/travel-stats.js`'s `computeTravelStats()` still credits every distinct country actually visited (pulls each leg's own resolved country in alongside the root's), so merging doesn't erase "visited 3 countries" just to fix the trip-count/PTO duplication.
- **Notification-side merge, per John's ask ("available right away in the notification part of newly scanned trips")** — `GET /api/trip-suggestions` now enriches each pending suggestion with `merge_candidates`; the Travel page's suggestion-review bell shows "Looks like part of: [dropdown of nearby existing trips] → Merge in" alongside the existing Add/Skip. Approving with a merge choice (`POST /api/trip-suggestions/[id]` now accepts an optional `merge_into_id`) still creates the trip normally (own itinerary import runs as usual) and immediately folds it in — same as a manual merge.
- **Trip-detail-side merge, per John's ask ("within each trip")** — `app/travel/[id]/page.jsx` has a new "Merged trip" section: if this trip is a leg, a banner links to its parent with an Unmerge button; if it has its own legs, each is listed with its own Unmerge button; either way, a picker to merge another existing trip in as a leg. The Travel list (timeline + past grid) shows a "+N legs" badge on a merged trip's card, and the PTO panel's trip rows show the same `(+N)` next to a merged trip's destination.
- `lib/assistant.js` catalog — added `merge_trips`/`unmerge_trip` tool entries (CLAUDE.md §7's "ship the route, don't forget the catalog half" rule) and updated `list_trips`/`get_trip`'s descriptions so the assistant knows a `merged_into_id` row isn't a separate trip for counting purposes.

**Verified:** `next build` succeeds (all new routes compiled: `/api/trips/[id]/merge`, `/api/trips/[id]/unmerge`). Not verified end-to-end against a live scan/merge/PTO-recount cycle in this sandbox — no Gmail/Neon network path here; `npm run migrate` still needs to run against the live DB before any of this is reachable (tracked above).

---

## Template for future entries

```
## YYYY-MM-DD — Short title

What changed, what was decided, why. Link related commits/PRs if applicable.
```
