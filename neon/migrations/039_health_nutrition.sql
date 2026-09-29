-- Nullable nutrients preserve unknown separately from a measured zero.
-- No historical intake or template row is backfilled.
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS fiber_g numeric(5, 1) CHECK (fiber_g >= 0);
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(5, 1) CHECK (saturated_fat_g >= 0);
ALTER TABLE health_favorite_meals ADD COLUMN IF NOT EXISTS fiber_g numeric(5, 1) CHECK (fiber_g >= 0);
ALTER TABLE health_favorite_meals ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(5, 1) CHECK (saturated_fat_g >= 0);
ALTER TABLE health_recommended_meals ADD COLUMN IF NOT EXISTS fiber_g numeric(5, 1) CHECK (fiber_g >= 0);
ALTER TABLE health_recommended_meals ADD COLUMN IF NOT EXISTS saturated_fat_g numeric(5, 1) CHECK (saturated_fat_g >= 0);

ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS fiber_target_g numeric(5, 1) NOT NULL DEFAULT 30 CHECK (fiber_target_g > 0);

-- Fruit follows vegetable servings: an omitted serving count records zero.
ALTER TABLE health_intake_entries ADD COLUMN IF NOT EXISTS fruit_servings numeric(4, 1) NOT NULL DEFAULT 0 CHECK (fruit_servings >= 0);
ALTER TABLE health_favorite_meals ADD COLUMN IF NOT EXISTS fruit_servings numeric(4, 1) NOT NULL DEFAULT 0 CHECK (fruit_servings >= 0);
ALTER TABLE health_recommended_meals ADD COLUMN IF NOT EXISTS fruit_servings numeric(4, 1) NOT NULL DEFAULT 0 CHECK (fruit_servings >= 0);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS fruit_target_servings numeric(3, 1) NOT NULL DEFAULT 1 CHECK (fruit_target_servings > 0);
