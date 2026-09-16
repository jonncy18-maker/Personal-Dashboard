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
CREATE TABLE IF NOT EXISTS health_weight_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date  date NOT NULL UNIQUE,
  weight_lb     numeric(5, 1) NOT NULL,
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
CREATE TABLE IF NOT EXISTS health_intake_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date     date NOT NULL,
  meal           text NOT NULL
                 CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description    text NOT NULL,
  calories       integer NOT NULL CHECK (calories >= 0),
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
