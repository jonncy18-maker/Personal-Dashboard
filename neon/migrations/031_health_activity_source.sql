-- Lets the daily target's activity multiplier come from a trailing average
-- of logged steps instead of the manual number, per the 2026-09-16 scoping
-- session's "steps set the daily multiplier from trailing activity; they
-- never credit calories back intraday" decision — deferred at the time
-- (steps tracking itself didn't exist yet), built out now that it does.
--
-- 'manual' stays the default: nothing changes for a profile that never
-- opts in. activity_multiplier itself is unchanged in meaning — it is both
-- the value used when activity_source = 'manual' AND the fallback used
-- when 'steps_trailing' doesn't yet have enough logged days in its window.
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS activity_source text
  NOT NULL DEFAULT 'manual'
  CHECK (activity_source IN ('manual', 'steps_trailing'));
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS activity_trailing_days integer
  NOT NULL DEFAULT 14 CHECK (activity_trailing_days > 0);
