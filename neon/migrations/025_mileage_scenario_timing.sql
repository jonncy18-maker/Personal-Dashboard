-- Scenario timing (migration 025) — John's ask: a scenario should be able to
-- say WHEN it's expected to happen, not just how much it adds. Two shapes:
-- recurring (a routine change that starts on some month and runs from then
-- on — effective_start, nullable = "since lease start", the old behavior)
-- and one_time (a single dated event or short span — one_time_start/end +
-- a flat one_time_miles figure, landing once that span has passed). Lets
-- John explain an unmodeled overage after the fact ("that was the move in
-- October") instead of only guess-fitting a recurring scenario's numbers.
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS occurrence text
  NOT NULL DEFAULT 'recurring' CHECK (occurrence IN ('recurring', 'one_time'));
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS effective_start date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_start date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_end date;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS one_time_miles integer;
