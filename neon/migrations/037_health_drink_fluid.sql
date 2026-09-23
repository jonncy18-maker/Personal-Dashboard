-- Fluid from drinks logged as food (a protein shake, a latte, juice).
-- Built 2026-09-23.
--
-- fluid_oz is the LIQUID a drink is made with, in US fl oz, counted in full
-- toward the day's water: a shake made with 12 oz of milk or water is 12 oz.
-- Not a guessed water-content fraction — milk, coffee and tea are mostly
-- water, and a per-drink percentage would add a fabricated number to move a
-- total by ~10%. Powders and solids don't count.
--
-- Nullable: NULL means "not a drink" (most food). The page and get_day show
-- drink fluid SEPARATELY from plain water (health_water_entries, migration
-- 036), so it is always visible how much of the total is a drink estimate.
-- Favorites carry it too, so the usual shake counts every time it's logged.
ALTER TABLE health_intake_entries
  ADD COLUMN IF NOT EXISTS fluid_oz numeric(5, 1) CHECK (fluid_oz > 0);
ALTER TABLE health_favorite_meals
  ADD COLUMN IF NOT EXISTS fluid_oz numeric(5, 1) CHECK (fluid_oz > 0);
