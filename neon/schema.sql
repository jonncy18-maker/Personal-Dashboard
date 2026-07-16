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
--                      004_language_calls, 005_travel_map_brief
--
-- Run on a fresh Neon project via the Neon MCP or the Neon SQL editor.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
                CHECK (status IN ('upcoming', 'past')),
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
