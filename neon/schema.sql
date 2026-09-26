-- Personal Dashboard — Neon Database Schema (canonical current state)
--
-- This file is the SINGLE SOURCE OF TRUTH for the current DB shape. Read this
-- one file to know what the database looks like now — never reassemble it from
-- the migrations/ history.
--
-- CONVENTION (see CLAUDE.md "Schema & Migrations"):
--   • Every change is a new numbered file in migrations/ (immutable, additive).
--   • After applying a migration, update THIS file to match the sum of all of them.
--   • All DDL is idempotent (IF NOT EXISTS) so re-running is safe.
--
-- Applied migrations: 001_initial, 002_trip_images, 003_trip_suggestions,
--                      004_language_calls, 005_travel_map_brief, 006_hero_image,
--                      007_project_meta, 008_project_category,
--                      009_trip_wishlist_status, 010_checklists,
--                      011_language_progress, 012_email_todos,
--                      013_calendar_hidden, 014_calendar_renames,
--                      015_trip_country, 016_pto, 017_mileage,
--                      018_mileage_usual_trips, 019_mileage_usual_legs,
--                      020_mileage_places, 021_mileage_scenario_legs,
--                      022_mileage_travel_exclusions, 023_trip_merge,
--                      024_pto_banked_shortfall, 025_mileage_scenario_timing,
--                      026_car_maintenance, 027_trip_history_scan,
--                      028_health_diet, 029_health_mcp_oauth,
--                      030_health_steps, 031_health_activity_source,
--                      032_health_macros_favorites, 033_health_recommended_meals,
--                      034_mileage_scenario_occurrences,
--                      035_health_veggie_servings, 036_health_water,
--                      037_health_drink_fluid, 038_mcp_auth_code_server
--
-- Run on a fresh Neon project with `npm run migrate` (scripts/migrate.js —
-- see CLAUDE.md §6), which applies every neon/migrations/*.sql file in order
-- and records each in schema_migrations. That script is the source of truth
-- for "has this been applied" going forward; this file is the source of truth
-- for "what does the schema look like" — the two are kept in sync by hand.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tracks which neon/migrations/*.sql files have been applied to this database
-- (see scripts/migrate.js). Not itself created by a migration file — the
-- runner creates it on first use — but listed here so schema.sql stays the
-- complete picture of the live schema.
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename    text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── AI Projects ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_url   text NOT NULL,
  vercel_url   text,
  status       text NOT NULL DEFAULT 'active'   -- manual lifecycle (drives tabs + counts)
               CHECK (status IN ('planning', 'active', 'needs_attention', 'on_hold', 'blocked', 'completed')),
  featured     boolean NOT NULL DEFAULT false,  -- at most one; the featured panel
  category     text,                            -- manual label (Mission/Personal/… — free text)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS projects_set_updated_at ON projects;
CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Travel ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination   text NOT NULL,
  start_date    date,
  end_date      date,
  status        text NOT NULL DEFAULT 'upcoming'
                CHECK (status IN ('upcoming', 'past', 'wishlist')),
  notes         text,
  budget        numeric,           -- coerce with num() at the API boundary
  itinerary     jsonb,
  image_url          text,         -- auto-fetched or manually overridden destination photo
  image_attribution  text,         -- required by Unsplash API terms when auto-fetched
  image_source       text NOT NULL DEFAULT 'auto'
                     CHECK (image_source IN ('auto', 'manual')),
  latitude      numeric,           -- geocoded destination coords for the Trip Map
  longitude     numeric,           -- (see lib/geocode.js) — one lookup per trip change
  geocoded_at   timestamptz,       -- when coords were last resolved (null = not yet tried)
  country              text,       -- reverse-geocoded from coords (Travel Stats "Countries" tile)
  country_code         text,       -- ISO code from the same reverse lookup
  country_geocoded_at  timestamptz, -- when country was last resolved (null = not yet tried)
  pto_days_override  integer,       -- PTO Planner: sticks once set, auto math never overwrites
  pto_exempt         boolean NOT NULL DEFAULT false, -- PTO Planner: trip contributes 0 PTO days
  merged_into_id  uuid REFERENCES trips (id) ON DELETE SET NULL, -- trip merging (migration 023): set when this row is a leg folded into another trip
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_merged_into_idx ON trips (merged_into_id);
DROP TRIGGER IF EXISTS trips_set_updated_at ON trips;
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cached AI Travel Brief (CLAUDE.md §7). One row; regenerated only when the
-- summarized trips change (keyed by `signature`), never per page load.
CREATE TABLE IF NOT EXISTS travel_brief (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief      text NOT NULL,
  signature  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS travel_brief_set_updated_at ON travel_brief;
CREATE TRIGGER travel_brief_set_updated_at
  BEFORE UPDATE ON travel_brief FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Home time-of-day hero photo cache (see lib/time-of-day.js). One Unsplash
-- fetch per band per day; a page load reads only this table.
CREATE TABLE IF NOT EXISTS hero_image (
  band               text NOT NULL,
  day                date NOT NULL,
  image_url          text,
  image_attribution  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (band, day)
);

-- ─── Schedules (has due_date — distinct from ideas) ───────────────────────────
CREATE TABLE IF NOT EXISTS schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  notes         text,
  due_date      date NOT NULL,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'done')),
  linked_trip_id     uuid REFERENCES trips(id) ON DELETE SET NULL,
  linked_project_id  uuid REFERENCES projects(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedules_due_date_idx ON schedules (due_date);
CREATE INDEX IF NOT EXISTS schedules_trip_idx ON schedules (linked_trip_id);
CREATE INDEX IF NOT EXISTS schedules_project_idx ON schedules (linked_project_id);
DROP TRIGGER IF EXISTS schedules_set_updated_at ON schedules;
CREATE TRIGGER schedules_set_updated_at
  BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Idea Board (no due_date — distinct from schedules) ───────────────────────
CREATE TABLE IF NOT EXISTS ideas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  notes         text,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'done')),
  domain_tag    text NOT NULL DEFAULT 'general'
                CHECK (domain_tag IN ('ai_projects', 'travel', 'schedules', 'language', 'general')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS ideas_set_updated_at ON ideas;
CREATE TRIGGER ideas_set_updated_at
  BEFORE UPDATE ON ideas FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Email ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier          smallint NOT NULL CHECK (tier IN (1, 2)),
  sender        text NOT NULL,
  rule_text     text,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_rules_sender_idx ON email_rules (sender);
DROP TRIGGER IF EXISTS email_rules_set_updated_at ON email_rules;
CREATE TRIGGER email_rules_set_updated_at
  BEFORE UPDATE ON email_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS email_hidden (
  gmail_message_id  text PRIMARY KEY,
  hidden_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_flags (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- To-do's flagged from the Email module (see 012_email_todos.sql). Read-only
-- Gmail means the flag lives here, never a Gmail star — same boundary as
-- email_hidden. Subject/sender/snippet are snapshotted at flag time so the
-- Home hero renders with no live Gmail call. `done_at` = dismissible (stamped,
-- not deleted, so it can be un-done); the hero shows only done_at IS NULL.
CREATE TABLE IF NOT EXISTS email_todos (
  gmail_message_id  text PRIMARY KEY,
  subject           text,
  sender            text,
  snippet           text,
  flagged_at        timestamptz NOT NULL DEFAULT now(),
  done_at           timestamptz
);
CREATE INDEX IF NOT EXISTS email_todos_open_idx
  ON email_todos (flagged_at DESC) WHERE done_at IS NULL;

-- ─── Calendar ───────────────────────────────────────────────────────────────
-- Hides individual events from the /calendar view (see 013_calendar_hidden.sql).
-- Google Calendar is read-only (§2/§7) — this only sets a local flag, never a
-- real calendar write. Title/start snapshotted at hide time so the "Hidden
-- events" popup can list them without a second live Calendar call.
CREATE TABLE IF NOT EXISTS calendar_hidden (
  gcal_event_id  text PRIMARY KEY,
  title          text,
  start_label    text,
  hidden_at      timestamptz NOT NULL DEFAULT now()
);

-- Locally rename an event or a whole recurring series on /calendar (see
-- 014_calendar_renames.sql). Same read-only boundary — never writes back to
-- Google Calendar. scope_id is either the event's own id ("just this event")
-- or its recurringEventId ("the whole series").
CREATE TABLE IF NOT EXISTS calendar_renames (
  scope_id    text PRIMARY KEY,
  scope       text NOT NULL CHECK (scope IN ('event', 'series')),
  title       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS calendar_renames_set_updated_at ON calendar_renames;
CREATE TRIGGER calendar_renames_set_updated_at
  BEFORE UPDATE ON calendar_renames FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Travel trip suggestions (weekly Gmail auto-detection) ────────────────────
CREATE TABLE IF NOT EXISTS trip_suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination      text NOT NULL,
  start_date       date,
  end_date         date,
  source_gmail_id  text UNIQUE,     -- the Gmail message this came from (dedupe key)
  source_subject   text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'dismissed')),
  raw              jsonb,           -- Haiku's raw extraction, for the review preview
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_suggestions_status_idx ON trip_suggestions (status);
DROP TRIGGER IF EXISTS trip_suggestions_set_updated_at ON trip_suggestions;
CREATE TRIGGER trip_suggestions_set_updated_at
  BEFORE UPDATE ON trip_suggestions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One-time historical Travel backfill (027) — the resumable cursor for
-- app/api/trip-history-scan. Single row (id fixed to 1). See that migration
-- for why this is separate from the weekly trip-scan's 30-day lookback.
CREATE TABLE IF NOT EXISTS trip_history_scan (
  id             integer PRIMARY KEY DEFAULT 1,
  since_year     integer NOT NULL,
  queries        jsonb NOT NULL,
  query_index    integer NOT NULL DEFAULT 0,
  page_token     text,
  scanned_count  integer NOT NULL DEFAULT 0,
  created_count  integer NOT NULL DEFAULT 0,
  done           boolean NOT NULL DEFAULT false,
  started_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
DROP TRIGGER IF EXISTS trip_history_scan_set_updated_at ON trip_history_scan;
CREATE TRIGGER trip_history_scan_set_updated_at
  BEFORE UPDATE ON trip_history_scan FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Language Learning ──────────────────────────────────────────────────────
-- The broader domain shape is still undecided (this table exists only to
-- support the one settled v1 slice below — do not add more Language tables
-- speculatively). The "next tutor call" card primarily reads live from Google
-- Calendar; this table is the review queue for the one gap Calendar can't
-- cover (italki lessons never create a Calendar event) — see the weekly scan
-- in app/api/language-scan and 004_language_calls.sql.
CREATE TABLE IF NOT EXISTS language_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor            text,
  start_at         timestamptz NOT NULL,
  source_gmail_id  text UNIQUE,
  source_subject   text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'dismissed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS language_calls_status_idx ON language_calls (status);
DROP TRIGGER IF EXISTS language_calls_set_updated_at ON language_calls;
CREATE TRIGGER language_calls_set_updated_at
  BEFORE UPDATE ON language_calls FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Travel prep checklists ─────────────────────────────────────────────────
-- Reusable packing/prep templates (checklist_templates), applied per trip
-- (trip_checklists) with items copied so editing a template never disturbs a
-- past trip's checked state. `items` groups by an optional `section` header —
-- the same flat-with-group-label shape as itinerary legs. See 010_checklists.sql.
CREATE TABLE IF NOT EXISTS checklist_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  items       jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{text, section}]
  position    integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS checklist_templates_set_updated_at ON checklist_templates;
CREATE TRIGGER checklist_templates_set_updated_at
  BEFORE UPDATE ON checklist_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS trip_checklists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  template_id  uuid REFERENCES checklist_templates (id) ON DELETE SET NULL,
  title        text NOT NULL,
  items        jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{text, section, done}]
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_checklists_trip_id_idx ON trip_checklists (trip_id);
DROP TRIGGER IF EXISTS trip_checklists_set_updated_at ON trip_checklists;
CREATE TRIGGER trip_checklists_set_updated_at
  BEFORE UPDATE ON trip_checklists FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Language progress (French hours log + per-language note) ────────────────
-- French: a screenshot-based Haiku import (CLAUDE.md §7) — Dreaming French has
-- no public API, so John pastes a screenshot of its progress page and Haiku
-- reads whatever numbers are legible. Never auto-saved (see
-- app/api/french-progress/save) — John confirms/edits the preview first,
-- since a vision read of a bar chart is inherently approximate.
CREATE TABLE IF NOT EXISTS french_hours_daily (
  log_date    date PRIMARY KEY,
  hours       numeric NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS french_hours_daily_set_updated_at ON french_hours_daily;
CREATE TRIGGER french_hours_daily_set_updated_at
  BEFORE UPDATE ON french_hours_daily FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Singleton headline total — kept separate from french_hours_daily's SUM()
-- since a screenshot rarely shows full history.
CREATE TABLE IF NOT EXISTS french_hours_summary (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_hours numeric NOT NULL,
  as_of_date  date NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS french_hours_summary_set_updated_at ON french_hours_summary;
CREATE TRIGGER french_hours_summary_set_updated_at
  BEFORE UPDATE ON french_hours_summary FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Spanish's editable "maintenance mode" line — Spanish is ambient/daily
-- immersion (phone, podcasts, music, tutor calls), not something with an
-- hours metric to track; this is a note, not a derived stat.
CREATE TABLE IF NOT EXISTS language_notes (
  language    text PRIMARY KEY CHECK (language IN ('spanish', 'french')),
  note        text NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS language_notes_set_updated_at ON language_notes;
CREATE TRIGGER language_notes_set_updated_at
  BEFORE UPDATE ON language_notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── PTO Planner (migration 016) ───────────────────────────────────────────
-- Self-set 25-day annual budget (no accrual — CrossCountry PTO is unlimited),
-- reset each calendar year. Days auto-derive from trips.pto_days_override/
-- pto_exempt above (weekdays minus firm holidays); manual whole-day entries
-- and a separate banked-holiday ledger sit alongside; see lib/pto.js.
CREATE TABLE IF NOT EXISTS pto_settings (
  id                       smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_budget            integer NOT NULL DEFAULT 25,  -- John's target, not an employer number
  use_banked_for_shortfall boolean NOT NULL DEFAULT false,  -- migration 024 — opt-in only, see Planning sub-tab
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- Firm holidays, editable in-app. `worked` feeds the banked counter. Stored
-- as the observed weekday date — the app never needs weekend observance math.
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
-- item shapes: {kind:'wishlist_trip', trip_id} — a dated wishlist trip —
--          or  {kind:'range', label, start_date, end_date} — an ad-hoc range.
CREATE TABLE IF NOT EXISTS pto_scenarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  items      jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Mileage calculator (migration 017) — Tesla lease tracker/forecaster ────
-- Lease fields are nullable — a fresh install shows an honest "set up your
-- lease" state rather than computing against fabricated defaults. See
-- lib/mileage.js for the pure pace/checkpoint math shared by server + client.
CREATE TABLE IF NOT EXISTS mileage_settings (
  id                      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lease_start_date        date,
  lease_term_months       integer NOT NULL DEFAULT 36,
  annual_allowance_miles  integer NOT NULL DEFAULT 10000,
  overage_rate_cents      integer NOT NULL DEFAULT 25,  -- cents per mile
  starting_odometer       integer,
  usual_miles             numeric,        -- "usual trips" baseline override (migration 018)
  usual_period            text NOT NULL DEFAULT 'week'
                          CHECK (usual_period IN ('day', 'week', 'month')),
  usual_active            boolean NOT NULL DEFAULT false, -- when true, replaces the logged-pace baseline
  vehicle_make            text,           -- vehicle profile (migration 026) — drives which
  vehicle_model           text,           -- maintenance preset list seeds, and labels the page
  vehicle_year            integer,
  vehicle_trim            text,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mileage_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DROP TRIGGER IF EXISTS mileage_settings_set_updated_at ON mileage_settings;
CREATE TRIGGER mileage_settings_set_updated_at
  BEFORE UPDATE ON mileage_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Dated odometer log — the ground truth for cumulative miles driven. Trip
-- log entries (below) are a supplementary journal, never summed into this.
CREATE TABLE IF NOT EXISTS mileage_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date  date NOT NULL UNIQUE,
  odometer      integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Point-to-point trip journal. miles is geocoded + routed via OSRM at save
-- time (lib/route-distance.js) when available, or entered by hand when a
-- lookup fails — either way it's cached on the row, never recomputed.
CREATE TABLE IF NOT EXISTS mileage_trips (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date        date,
  origin           text NOT NULL,
  destination      text NOT NULL,
  origin_lat       numeric,
  origin_lng       numeric,
  destination_lat  numeric,
  destination_lng  numeric,
  miles            numeric NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mileage_trips_date_idx ON mileage_trips (trip_date DESC);

-- Named forecast scenarios. John picks which are `active` — only active
-- scenarios' impact is added to a checkpoint's projection; unchecked ones
-- stay saved but excluded, never silently blended in.
CREATE TABLE IF NOT EXISTS mileage_scenarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  note        text,
  active      boolean NOT NULL DEFAULT false,
  impact_1yr  integer NOT NULL DEFAULT 0,
  impact_2yr  integer NOT NULL DEFAULT 0,
  impact_3yr  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS mileage_scenarios_set_updated_at ON mileage_scenarios;
CREATE TRIGGER mileage_scenarios_set_updated_at
  BEFORE UPDATE ON mileage_scenarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Named routes behind "usual trips" (migration 019) — the detail popup's
-- breakdown. Each leg's miles come from the same free geocode + OSRM lookup
-- the trip journal uses, or by hand; "Use this total" applies the computed
-- weekly sum to mileage_settings.usual_miles/usual_period above.
CREATE TABLE IF NOT EXISTS mileage_usual_legs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin          text NOT NULL,
  destination     text NOT NULL,
  miles           numeric NOT NULL,
  times_per_week  numeric NOT NULL DEFAULT 1,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Named favorite places (migration 020) — Home, Gym, Work, etc. A trip/leg
-- typed with a matching label (case-insensitive) resolves against the
-- cached lat/lng here instead of geocoding the bare label, which fixes
-- "Home" (not a real geocodable place) silently falling back to manual
-- mile entry on every lookup.
CREATE TABLE IF NOT EXISTS mileage_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,
  address     text NOT NULL,
  lat         numeric,
  lng         numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Lets a scenario reference a usual-trip leg + a new times/week instead of
-- a manually typed mile guess (migration 021) — "what if the cafe trip
-- became 3x/week instead of 2x?". impact_1yr/2yr/3yr above are still what
-- projectCheckpoint() reads; these are computed server-side at save/edit
-- time from the leg + the new frequency, same linear-from-lease-start
-- model the pace baseline itself uses.
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS leg_id uuid
  REFERENCES mileage_usual_legs (id) ON DELETE SET NULL;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS new_times_per_week numeric;

-- Travel Day Exclusions (migration 022) — a distinct section from Forecast
-- Scenarios: a real, one-time fact ("I wasn't home driving these days"),
-- not a hypothetical recurring routine change. Reviewed like Travel's Gmail
-- trip-suggestion queue: a real trip with no row here yet surfaces for
-- accept/dismiss; accepting snapshots the current baseline daily rate x day
-- count as miles_excluded so it never silently drifts if the pace later
-- changes. trip_id is nullable so a manual entry (a trip Travel doesn't
-- track) fits the same shape.
CREATE TABLE IF NOT EXISTS mileage_travel_exclusions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid REFERENCES trips (id) ON DELETE SET NULL,
  label            text,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  days             integer NOT NULL,
  daily_rate_used  numeric,
  miles_excluded   numeric,
  status           text NOT NULL DEFAULT 'accepted'
                   CHECK (status IN ('accepted', 'dismissed')),
  source           text NOT NULL CHECK (source IN ('travel', 'manual')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mileage_travel_exclusions_trip_id_idx
  ON mileage_travel_exclusions (trip_id);

-- Scenario timing (migration 025) — a scenario can now say WHEN it's
-- expected to happen, not just how much it adds. `occurrence` splits it
-- into 'recurring' (a routine change; `effective_start` is the month it
-- begins — null means "since lease start", the pre-025 behavior, and
-- lib/mileage.js scales the stored impact_Nyr proportionally from that
-- month instead of lease start) or 'one_time' (a single dated event/span:
-- `one_time_start`/`one_time_end` + a flat `one_time_miles`, landing once
-- that span has passed — a real fact John can add after the fact to
-- explain an unmodeled overage, not a hypothetical recurring change).
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS occurrence text
  NOT NULL DEFAULT 'recurring' CHECK (occurrence IN ('recurring', 'one_time'));
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS effective_start date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_start date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_end date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_miles integer;

-- Scenario Realization (migration 034) — occurrence_count is the total
-- planned trips a one-time scenario represents (nullable; unset scenarios
-- keep landing at the flat one_time_miles exactly as before). realized_count
-- tracks how many have actually happened, moved one at a time via the
-- /realize endpoint. lib/mileage.js scales one_time_miles by the unrealized
-- fraction once a count is set — see scenarioImpactForCheckpoint.
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS occurrence_count integer;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS realized_count integer
  NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Car maintenance (migration 026) — the /car domain's Maintenance tab.
-- ---------------------------------------------------------------------------
-- The service schedule. Due points are computed in lib/maintenance.js off the
-- odometer log's existing forecast (lib/mileage.js monthlyForecast), never a
-- second pace calculation.
--
-- `source` records where an interval came from and is never inferred:
--   official — the manufacturer's published schedule (source_url set)
--   starter  — an unverified built-in default, shown as such until confirmed
--   manual   — typed by John
--
-- Both intervals are nullable. An `official` row may legitimately have
-- neither: the Model 3 manual's "Brake fluid health check every  years"
-- states no number, so it is stored null and rendered as "interval not
-- stated in source" rather than back-filled with a guess.
--
-- `condition_note` carries a trigger the app CANNOT compute (tire tread
-- depth; "only where roads are salted in winter"). It is displayed as a
-- stated condition and never turned into a due date.
CREATE TABLE IF NOT EXISTS maintenance_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  interval_miles     integer,
  interval_months    integer,
  condition_note     text,
  active             boolean NOT NULL DEFAULT true,
  source             text NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('official', 'starter', 'manual')),
  source_url         text,
  source_fetched_at  timestamptz,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS maintenance_items_set_updated_at ON maintenance_items;
CREATE TRIGGER maintenance_items_set_updated_at
  BEFORE UPDATE ON maintenance_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per completed service. "Last done" is the latest row for an item,
-- which is why rolling forward to the next period needs no extra item state.
-- `odometer` is NOT written into mileage_readings — that log stays the single
-- ground truth for cumulative miles. A check-off may also insert a reading,
-- but only when John explicitly opts in at confirm time.
CREATE TABLE IF NOT EXISTS maintenance_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES maintenance_items (id) ON DELETE CASCADE,
  service_date  date NOT NULL,
  odometer      integer,
  cost_cents    integer,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maintenance_records_item_idx
  ON maintenance_records (item_id, service_date DESC);

-- ── Health › Diet (migration 028) ───────────────────────────────────────
-- Health › Diet (the 8th domain) — calories and weight.
-- See ROADMAP.md's 2026-09-16 scoping entry for the decisions behind this.
--
-- Two tables plus a singleton profile. The profile is id = 1 for the same
-- reason mileage_settings is: this app has exactly one body to track, and
-- multi-person stays unbuilt until it is actually wanted.
--
-- AGE IS STORED TWICE, DELIBERATELY. `birth_date` is the only representation
-- that does not silently go stale — age derives from the server clock. But it
-- demands a date John may not want to type, so `age_years` is the fallback he
-- can enter directly. The API prefers birth_date and falls back to age_years;
-- it never averages them or guesses one from the other.
CREATE TABLE IF NOT EXISTS health_profile (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sex                  text CHECK (sex IN ('male', 'female')),
  birth_date           date,
  age_years            integer,
  height_in            numeric(4, 1),
  activity_multiplier  numeric(3, 2) NOT NULL DEFAULT 1.75,
  -- 'manual' (default): activity_multiplier above is used as-is. 'steps_trailing':
  -- the multiplier is derived from a trailing average of logged steps
  -- (migration 031) once activity_trailing_days has enough logged days;
  -- until then activity_multiplier is the fallback. Never credits steps back
  -- intraday — see lib/health.js's computeTarget.
  activity_source      text NOT NULL DEFAULT 'manual'
                       CHECK (activity_source IN ('manual', 'steps_trailing')),
  activity_trailing_days integer NOT NULL DEFAULT 14 CHECK (activity_trailing_days > 0),
  goal_weight_lb       numeric(5, 1),
  goal_date            date,
  -- The safe floor the daily target may never fall below, as a fraction of
  -- computed maintenance. `manual_floor_cal` overrides it with a flat number
  -- (a doctor's figure). The floor is never a hardcoded constant in code.
  floor_pct            numeric(3, 2) NOT NULL DEFAULT 0.60,
  manual_floor_cal     integer,
  -- When set, the formula stops computing entirely and this number IS the
  -- target (CLAUDE.md §7.3 — a figure John maintains outranks a derived one).
  manual_target_cal    integer,
  -- Daily vegetable-servings baseline (migration 035) — a field John
  -- maintains, not a constant in code. get_day reports whether it was met.
  veggie_target_servings numeric(3, 1) NOT NULL DEFAULT 2
                       CHECK (veggie_target_servings > 0),
  -- Optional daily water goal in US fl oz (migration 036). NULL by default:
  -- no goal was named, and a guessed one would be a fabricated target. With
  -- no goal the day shows its total with no met/not-met verdict.
  water_target_oz      numeric(5, 1) CHECK (water_target_oz > 0),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS health_profile_set_updated_at ON health_profile;
CREATE TRIGGER health_profile_set_updated_at
  BEFORE UPDATE ON health_profile FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO health_profile (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- The dated weight log. Ground truth for both the trend and the target's
-- weight input — the same role the odometer log plays for Car.
--
-- One reading per calendar day (a re-weigh on the same day corrects it rather
-- than appending), which is what makes the upsert in the API safe. Gaps are
-- expected and are never interpolated: John weighs sporadically, so a missing
-- week is a missing week, not a value to invent.
-- weight_lb is nullable (migration 030): a steps-only day is a real row with
-- no weight in it. `steps` is a display/log-only metric, deliberately never
-- fed into any calorie math — see that migration's comment.
CREATE TABLE IF NOT EXISTS health_weight_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date  date NOT NULL UNIQUE,
  weight_lb     numeric(5, 1),
  steps         integer CHECK (steps >= 0),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS health_weight_readings_set_updated_at ON health_weight_readings;
CREATE TRIGGER health_weight_readings_set_updated_at
  BEFORE UPDATE ON health_weight_readings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS health_weight_readings_date_idx
  ON health_weight_readings (reading_date DESC);

-- Intake. One row per thing eaten, bucketed by meal.
--
-- `source` is the honesty mechanism and is never inferred — it records how the
-- calorie figure was arrived at, and drives the tilde in every rendered total:
--   label     — read off a nutrition panel or a posted menu. Transcription.
--   recall    — a branded item recalled by the model. A real published number,
--               possibly stale, delivered with the same confidence either way.
--   estimated — from pixels or a generic description. No authoritative number
--               exists for it at all.
-- Anything that is not `label` makes the day's total an estimate.
--
-- `logged_via` records the capture path. Claude-over-MCP is the primary one
-- by design (see the ROADMAP entry); 'app' is the fallback surface.
-- protein_g/carbs_g/fat_g (migration 032) are nullable for the same reason
-- steps is on health_weight_readings: an existing or manually-typed row may
-- simply not have them, and a NOT NULL default of 0 would misrepresent
-- "not logged" as "zero grams" — this domain never fabricates a number.
-- veggie_servings (migration 035) is the deliberate exception: NOT NULL
-- DEFAULT 0, because it only feeds a "did the day reach its minimum" check,
-- so an unassessed 0 can only under-count (reads NOT met), never fabricate a
-- success. A serving ≈ 1 cup raw or 1/2 cup cooked vegetables.
CREATE TABLE IF NOT EXISTS health_intake_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date     date NOT NULL,
  meal           text NOT NULL
                 CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description    text NOT NULL,
  calories       integer NOT NULL CHECK (calories >= 0),
  protein_g      numeric(5, 1) CHECK (protein_g >= 0),
  carbs_g        numeric(5, 1) CHECK (carbs_g >= 0),
  fat_g          numeric(5, 1) CHECK (fat_g >= 0),
  veggie_servings numeric(4, 1) NOT NULL DEFAULT 0 CHECK (veggie_servings >= 0),
  -- Liquid a drink is made with, US fl oz (migration 037); NULL = not a
  -- drink. Counted in full toward water, shown apart from plain water.
  fluid_oz       numeric(5, 1) CHECK (fluid_oz > 0),
  source         text NOT NULL
                 CHECK (source IN ('label', 'recall', 'estimated')),
  -- Where a `label` came from (a menu, a wrapper, a URL) or what a `recall`
  -- was matched against. Free text — displayed, never parsed.
  source_detail  text,
  logged_via     text NOT NULL DEFAULT 'app'
                 CHECK (logged_via IN ('app', 'mcp')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS health_intake_entries_set_updated_at ON health_intake_entries;
CREATE TRIGGER health_intake_entries_set_updated_at
  BEFORE UPDATE ON health_intake_entries FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS health_intake_entries_date_idx
  ON health_intake_entries (entry_date DESC);

-- Water, one row per drink (migration 036). Its own table rather than an
-- intake row, so a drink never counts toward "N of 4 meals logged". The
-- day's figure is a SUM; ounces are US fl oz (cups and ml are converted on
-- the way in).
CREATE TABLE IF NOT EXISTS health_water_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  date NOT NULL,
  ounces      numeric(5, 1) NOT NULL CHECK (ounces > 0),
  logged_via  text NOT NULL DEFAULT 'app' CHECK (logged_via IN ('app', 'mcp')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_water_entries_date_idx
  ON health_water_entries (entry_date);

-- A reusable template for a meal that repeats verbatim (migration 032) — e.g.
-- the same breakfast every day. Logging one inserts a fresh
-- health_intake_entries row copied from these fields; `source` still carries
-- the same honesty tiers as any other entry, earned by the number itself,
-- not by being reused.
CREATE TABLE IF NOT EXISTS health_favorite_meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  meal         text CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description  text NOT NULL,
  calories     integer NOT NULL CHECK (calories >= 0),
  protein_g    numeric(5, 1) CHECK (protein_g >= 0),
  carbs_g      numeric(5, 1) CHECK (carbs_g >= 0),
  fat_g        numeric(5, 1) CHECK (fat_g >= 0),
  veggie_servings numeric(4, 1) NOT NULL DEFAULT 0 CHECK (veggie_servings >= 0),
  fluid_oz     numeric(5, 1) CHECK (fluid_oz > 0),
  source       text NOT NULL CHECK (source IN ('label', 'recall', 'estimated')),
  source_detail text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS health_favorite_meals_set_updated_at ON health_favorite_meals;
CREATE TRIGGER health_favorite_meals_set_updated_at
  BEFORE UPDATE ON health_favorite_meals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- "Recommended meals" (migration 033) — Claude-curated nudges toward a
-- healthier baseline, distinct from health_favorite_meals above (things
-- John already eats and saves himself). 'today' recommendations react to a
-- specific day's remaining calories/macros (for_date required); 'ongoing'
-- ones are standing habit-level suggestions with no expiry (for_date null).
-- No `source` tier — a recommendation isn't logged food yet; logging one
-- (log_recommended_meal) creates a fresh health_intake_entries row that
-- gets its own normal source tier at that point. Meal-shaped fields are
-- nullable since an 'ongoing' habit suggestion may be pure guidance text
-- with no specific food/calorie count behind it.
CREATE TABLE IF NOT EXISTS health_recommended_meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horizon      text NOT NULL CHECK (horizon IN ('today', 'ongoing')),
  for_date     date,
  title        text NOT NULL,
  detail       text NOT NULL,
  meal         text CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories     integer CHECK (calories >= 0),
  protein_g    numeric(5, 1) CHECK (protein_g >= 0),
  carbs_g      numeric(5, 1) CHECK (carbs_g >= 0),
  fat_g        numeric(5, 1) CHECK (fat_g >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (horizon = 'today' AND for_date IS NOT NULL) OR
    (horizon = 'ongoing' AND for_date IS NULL)
  )
);
DROP TRIGGER IF EXISTS health_recommended_meals_set_updated_at ON health_recommended_meals;
CREATE TRIGGER health_recommended_meals_set_updated_at
  BEFORE UPDATE ON health_recommended_meals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS health_recommended_meals_horizon_idx
  ON health_recommended_meals (horizon, for_date);

-- OAuth handshake for the Health MCP server (see migration 029). The
-- access/refresh token this hands back IS HEALTH_MCP_TOKEN itself — this
-- table only holds short-lived, single-use authorization codes so the code
-- issued by /authorize can be redeemed at /token from a different serverless
-- invocation.
CREATE TABLE IF NOT EXISTS health_mcp_auth_codes (
  code                   text PRIMARY KEY,
  code_challenge         text,
  code_challenge_method  text NOT NULL DEFAULT 'S256',
  redirect_uri           text NOT NULL,
  expires_at             timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  -- Issuing server's token env var (038) — a code redeems only there.
  server                 text
);
