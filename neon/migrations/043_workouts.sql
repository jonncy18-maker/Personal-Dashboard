-- Health › Workouts: a strength-training log with reusable templates.
-- Built 2026-11-16. Reverses the 2026-09-16 "no training log" decision at
-- John's request — he now wants progressive overload tracked per set.
--
-- The split that matters: TEMPLATES are the plan, SETS are the record. A
-- logged set points at an exercise and a session, never at a template row,
-- so editing or deleting a template can never rewrite history.

-- Goals and constraints are data John maintains, not constants in code:
-- both AI clients read them through the MCP tools, and this repo is public.
CREATE TABLE IF NOT EXISTS workout_profile (
  id              int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  goals           text,
  constraints     text,
  target_minutes  int CHECK (target_minutes > 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  equipment     text NOT NULL CHECK (equipment IN ('machine', 'cable', 'cardio', 'other')),
  muscle_group  text,
  -- Default for the per-side toggle when logging; the truth for any one set
  -- is workout_sets.per_side.
  unilateral    boolean NOT NULL DEFAULT false,
  notes         text,
  -- An exercise with logged sets is archived, never deleted: its history
  -- has to keep a name.
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS workout_exercises_name_idx
  ON workout_exercises (lower(name));

CREATE TABLE IF NOT EXISTS workout_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  focus       text,
  notes       text,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_template_exercises (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id  uuid NOT NULL REFERENCES workout_templates (id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES workout_exercises (id),
  position     int NOT NULL,
  target_sets  int CHECK (target_sets > 0),
  rep_min      int CHECK (rep_min > 0),
  rep_max      int CHECK (rep_max > 0),
  notes        text,
  CHECK (rep_min IS NULL OR rep_max IS NULL OR rep_min <= rep_max)
);
CREATE INDEX IF NOT EXISTS workout_template_exercises_template_idx
  ON workout_template_exercises (template_id, position);

-- The weekly plan: one row per weekday (0 = Sunday … 6 = Saturday). A day is
-- a template, or just a label ("Rest", "Cardio") with no template behind it.
CREATE TABLE IF NOT EXISTS workout_schedule (
  weekday      smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  template_id  uuid REFERENCES workout_templates (id) ON DELETE SET NULL,
  label        text
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date      date NOT NULL,
  -- Copied from the template when the session starts, so renaming or
  -- deleting the template later leaves this session's title alone.
  name              text NOT NULL,
  template_id       uuid REFERENCES workout_templates (id) ON DELETE SET NULL,
  status            text NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('in_progress', 'completed')),
  -- False = the workout happened but its exercises/sets were not captured.
  -- Such a session counts as a training day and nothing else.
  details_complete  boolean NOT NULL DEFAULT true,
  duration_min      int CHECK (duration_min > 0),
  notes             text,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_sessions_date_idx
  ON workout_sessions (session_date DESC);

-- One row per set, so two sets of the same exercise can differ in weight.
CREATE TABLE IF NOT EXISTS workout_sets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid NOT NULL REFERENCES workout_sessions (id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES workout_exercises (id),
  set_number   int NOT NULL CHECK (set_number > 0),
  weight_lb    numeric(6, 2) CHECK (weight_lb >= 0),
  reps         int CHECK (reps >= 0),
  -- True = weight and reps are per arm/leg. NULL = not confirmed; never
  -- guessed from the exercise name.
  per_side     boolean,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_sets_session_idx
  ON workout_sets (session_id, exercise_id, set_number);
CREATE INDEX IF NOT EXISTS workout_sets_exercise_idx
  ON workout_sets (exercise_id);
