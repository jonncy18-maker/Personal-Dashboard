-- "Recommended meals" — Claude-curated nudges toward a healthier baseline,
-- distinct from health_favorite_meals (things John already eats and saves
-- himself). Built 2026-09-18 per John's scoping answers:
--   - Two horizons: 'today' (reacts to a specific day's remaining
--     calories/macros) and 'ongoing' (a standing habit-level suggestion,
--     e.g. "eat more fiber at breakfast", that doesn't expire).
--   - No `source` tier: a recommendation isn't logged food yet, so the
--     label/recall/estimated honesty system doesn't apply to it. Once John
--     logs one (log_recommended_meal, mirroring log_favorite_meal), THAT
--     fresh health_intake_entries row gets a normal source tier.
--   - Meal-shaped fields are nullable: an 'ongoing' habit suggestion is not
--     a specific food with a calorie count, while a 'today' one usually is.
--   - Claude has full write access via MCP, but every write tool's
--     description requires John to have just confirmed in the conversation
--     first — the chat itself is the preview/confirm step, same spirit as
--     every other AI-import path in this app never auto-saving.
CREATE TABLE IF NOT EXISTS health_recommended_meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horizon      text NOT NULL CHECK (horizon IN ('today', 'ongoing')),
  -- Only set for 'today' recommendations — which day it was relevant to.
  -- 'ongoing' ones are evergreen until edited or removed.
  for_date     date,
  title        text NOT NULL,
  detail       text NOT NULL,
  meal         text CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  calories     integer CHECK (calories >= 0),
  protein_g    numeric(5, 1) CHECK (protein_g >= 0),
  carbs_g      numeric(5, 1) CHECK (carbs_g >= 0),
  fat_g        numeric(5, 1) CHECK (fat_g >= 0),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (horizon = 'today' AND for_date IS NOT NULL) OR
    (horizon = 'ongoing' AND for_date IS NULL)
  )
);
DROP TRIGGER IF EXISTS health_recommended_meals_set_updated_at ON health_recommended_meals;
CREATE TRIGGER health_recommended_meals_set_updated_at
  BEFORE UPDATE ON health_recommended_meals FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS health_recommended_meals_horizon_idx
  ON health_recommended_meals (horizon, for_date);
