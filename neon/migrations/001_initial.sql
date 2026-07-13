-- Personal Dashboard — Migration 001 (initial)
-- Settled domains only. Undecided domains (Language Learning) are intentionally
-- NOT here — see CLAUDE.md "Schema & Migrations" for the convention.
--
-- Migrations are immutable and additive: never edit an applied file. A later
-- change (settling Language, adding a new domain) is a NEW numbered file, and
-- schema.sql is updated to reflect the sum of all migrations.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── AI Projects ──────────────────────────────────────────────────────────────
-- Tracked projects. Vercel URL optional (blank = protocol/library repo, GitHub
-- only). No auto-detection — two explicit fields, per CLAUDE.md.
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
  itinerary     jsonb,             -- day-by-day/port detail, AI-import populates
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trips_set_updated_at ON trips;
CREATE TRIGGER trips_set_updated_at
  BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Schedules ────────────────────────────────────────────────────────────────
-- Cross-domain "things to do by a date". DISTINCT from ideas by the presence of
-- a due date (NOT NULL here). Optional one-way link to a trip or project.
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

-- ─── Idea Board ───────────────────────────────────────────────────────────────
-- DISTINCT from schedules: NO due date ("someday/maybe"). Kept as a separate
-- table deliberately, not schedules-with-optional-date. See CLAUDE.md.
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
-- Two rule tiers, kept structurally distinct (see CLAUDE.md):
--   tier 1 = deterministic sender rule (NO AI; sender parsed directly)
--   tier 2 = plain-language rule, evaluated by Haiku only for the semantic
--            residual Gmail's native categories/operators can't express.
CREATE TABLE IF NOT EXISTS email_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier          smallint NOT NULL CHECK (tier IN (1, 2)),
  sender        text NOT NULL,           -- domain (tier 1) or specific sender (tier 2)
  rule_text     text,                    -- tier 2 only: the plain-language rule
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_rules_sender_idx ON email_rules (sender);
DROP TRIGGER IF EXISTS email_rules_set_updated_at ON email_rules;
CREATE TRIGGER email_rules_set_updated_at
  BEFORE UPDATE ON email_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Local hidden flags: hiding an email NEVER touches the real Gmail mailbox.
-- This table IS the "hidden" state, keyed by Gmail message id.
CREATE TABLE IF NOT EXISTS email_hidden (
  gmail_message_id  text PRIMARY KEY,
  hidden_at         timestamptz NOT NULL DEFAULT now()
);

-- One-row app-level flags (e.g. first-run onboarding scan completed).
-- The onboarding scan must run at most once — this is how we remember.
CREATE TABLE IF NOT EXISTS app_flags (
  key    text PRIMARY KEY,
  value  jsonb NOT NULL DEFAULT '{}'::jsonb
);
