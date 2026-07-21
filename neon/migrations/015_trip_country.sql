-- 015_trip_country.sql
-- Travel Stats bar: a "Countries" tile counts distinct countries across real
-- trips. The country isn't in the free-text destination ("Denver", "Cebu"), so
-- it's reverse-geocoded from the coords already cached on each trip (see
-- lib/geocode.js reverseGeocodeCountry) — one lookup per trip, never per load,
-- the same discipline as the destination coords themselves. `country_geocoded_at`
-- stamps the attempt so an unresolvable trip isn't retried on every stats load;
-- a destination change resets it (in the trips PATCH) so the country refreshes.
-- Additive + idempotent, per CLAUDE.md §6.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_code text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS country_geocoded_at timestamptz;
