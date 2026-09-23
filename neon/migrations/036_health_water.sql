-- Water intake, logged one drink at a time. Built 2026-09-23.
--
-- Its own table, not a row in health_intake_entries: water is not food, and
-- an intake row (even at 0 calories) would count toward "N of 4 meals
-- logged" — the completeness signal that stops an unlogged day reading as a
-- good one. A drink must never make a day look more logged than it is.
--
-- One row per drink ("I just drank an 8 oz cup"), not a running daily
-- total: the day's figure is a SUM, and a mistaken drink is removed on its
-- own without rewriting the rest. Stored in US fluid ounces, the unit John
-- thinks in; the tools accept cups (8 oz) and ml and convert on the way in.
CREATE TABLE IF NOT EXISTS health_water_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  date NOT NULL,
  ounces      numeric(5, 1) NOT NULL CHECK (ounces > 0),
  logged_via  text NOT NULL DEFAULT 'app' CHECK (logged_via IN ('app', 'mcp')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS health_water_entries_date_idx
  ON health_water_entries (entry_date);

-- An optional daily goal John sets himself. Deliberately NULL by default,
-- unlike veggie_target_servings: John asked for a baseline there, but named
-- no water goal, and a guessed "64 oz" would be a number with nothing behind
-- it. With no target the day shows its total and no met/not-met verdict.
ALTER TABLE health_profile
  ADD COLUMN IF NOT EXISTS water_target_oz numeric(5, 1)
  CHECK (water_target_oz > 0);
