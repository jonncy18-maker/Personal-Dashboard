-- 018_mileage_usual_trips.sql — Mileage: a "usual trips" baseline override.
--
-- John can state a routine mileage rate (e.g. "40 mi/day" or "300 mi/week")
-- instead of relying purely on the logged-pace calculation. When
-- `usual_active` is checked, lib/mileage.js uses this rate (converted to a
-- daily pace) as the checkpoint baseline instead of the actual odometer-log
-- pace — active scenarios still add on top either way. Unchecked, nothing
-- changes: the existing logged-pace baseline + scenarios, as before.

ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS usual_miles numeric;
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS usual_period text NOT NULL DEFAULT 'week';
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS usual_active boolean NOT NULL DEFAULT false;

ALTER TABLE mileage_settings DROP CONSTRAINT IF EXISTS mileage_settings_usual_period_check;
ALTER TABLE mileage_settings ADD CONSTRAINT mileage_settings_usual_period_check
  CHECK (usual_period IN ('day', 'week', 'month'));
