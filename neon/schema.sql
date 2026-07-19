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
--                      011_language_progress, 012_email_todos
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
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
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
