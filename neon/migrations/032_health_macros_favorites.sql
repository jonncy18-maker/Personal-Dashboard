-- Adds protein/carbs/fat to intake logging (the strongest item on the
-- health skill's "deferred to v2" list — "at 122 lb lifting in a deficit,
-- protein is what decides fat versus muscle") and a saved-favorite-meals
-- table for one-tap re-logging of a meal that repeats verbatim (e.g. the
-- same breakfast every day). Built 2026-09-18.
--
-- Macros are nullable, same reasoning as health_weight_readings.steps: an
-- existing row, or a manually-typed one, may simply not have them, and a
-- NOT NULL default of 0 would silently misrepresent "not logged" as "zero
-- grams" — a fabricated number the rest of this domain never allows.
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS protein_g numeric(5, 1) CHECK (protein_g >= 0);
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS carbs_g   numeric(5, 1) CHECK (carbs_g >= 0);
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS fat_g     numeric(5, 1) CHECK (fat_g >= 0);

-- A favorite is a reusable template, not a log entry — logging it inserts a
-- fresh health_intake_entries row dated today (or whatever date is asked
-- for), copied from the template's fields. `source` still carries the same
-- honesty tiers as any other entry: a favorite doesn't earn 'label' just by
-- being reused, it earns whatever tier its own number actually deserves.
CREATE TABLE IF NOT EXISTS health_favorite_meals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  meal         text CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
  description  text NOT NULL,
  calories     integer NOT NULL CHECK (calories >= 0),
  protein_g    numeric(5, 1) CHECK (protein_g >= 0),
  carbs_g      numeric(5, 1) CHECK (carbs_g >= 0),
  fat_g        numeric(5, 1) CHECK (fat_g >= 0),
  source       text NOT NULL CHECK (source IN ('label', 'recall', 'estimated')),
  source_detail text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS health_favorite_meals_set_updated_at ON health_favorite_meals;
CREATE TRIGGER health_favorite_meals_set_updated_at
  BEFORE UPDATE ON health_favorite_meals FOR EACH ROW EXECUTE FUNCTION set_updated_at();
