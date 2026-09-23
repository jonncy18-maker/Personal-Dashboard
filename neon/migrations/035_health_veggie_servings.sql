-- Vegetable servings on intake entries, plus a daily servings target on the
-- profile. Built 2026-09-23.
--
-- A serving is roughly 1 cup raw or 1/2 cup cooked vegetables (USDA's
-- MyPlate cup-equivalent guidance, halved to the everyday "serving" John
-- asked for). Recorded per entry, summed per day.
--
-- DEFAULT 0, unlike protein_g/carbs_g/fat_g (migration 032), which are
-- nullable precisely so "not logged" never reads as "zero grams". The
-- difference is the direction a wrong zero fails in: servings only feed a
-- "did the day reach its minimum" check, so an unassessed entry reading as 0
-- can only under-count — the day shows NOT met, never a fabricated success.
-- A zero protein figure has no such safe direction. John asked for the
-- default explicitly; this is why it's acceptable here and not there.
ALTER TABLE health_intake_entries
  ADD COLUMN IF NOT EXISTS veggie_servings numeric(4, 1) NOT NULL DEFAULT 0
  CHECK (veggie_servings >= 0);

-- Favorites carry it too: logging a favorite copies its fields into a fresh
-- intake row, and the favorite path is how the repeated daily meals get
-- logged — without this, every one-tap log would record 0.
ALTER TABLE health_favorite_meals
  ADD COLUMN IF NOT EXISTS veggie_servings numeric(4, 1) NOT NULL DEFAULT 0
  CHECK (veggie_servings >= 0);

-- The daily baseline lives on the profile (a field John maintains), not as a
-- constant in code — same treatment as floor_pct. 2 servings to start;
-- raising it is an update_health_profile call, not a deploy.
ALTER TABLE health_profile
  ADD COLUMN IF NOT EXISTS veggie_target_servings numeric(3, 1) NOT NULL DEFAULT 2
  CHECK (veggie_target_servings > 0);
