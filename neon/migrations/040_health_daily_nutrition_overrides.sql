-- A day-level statement of fiber / saturated fat for days that were logged
-- (or reconstructed) as a daily total rather than item by item. It sits beside
-- health_intake_entries instead of being forced onto an arbitrary food or a
-- fake zero-calorie entry, so per-entry data stays honest. A non-null value
-- here replaces the per-entry sum for that nutrient on that day only.
-- No historical row is written by this migration.
CREATE TABLE IF NOT EXISTS health_daily_nutrition_overrides (
  entry_date      date PRIMARY KEY,
  fiber_g         numeric(5, 1) CHECK (fiber_g >= 0),
  saturated_fat_g numeric(5, 1) CHECK (saturated_fat_g >= 0),
  source          text NOT NULL CHECK (source IN ('label', 'recall', 'estimated')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (fiber_g IS NOT NULL OR saturated_fat_g IS NOT NULL)
);
