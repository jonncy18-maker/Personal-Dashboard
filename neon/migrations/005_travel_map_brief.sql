-- 005_travel_map_brief.sql
-- Travel redesign: geocoded map pins + a cached AI Travel Brief.
--
-- 1. trips gains latitude/longitude (+ geocoded_at) so the Trip Map can plot a
--    real pin per destination. Populated once when a trip is created/edited via
--    a geocoding lookup (lib/geocode.js), the same "one call per trip change,
--    never per page load" rule the Unsplash photo already follows.
-- 2. travel_brief caches the Haiku-generated brief (CLAUDE.md §7). One row; it
--    is regenerated only when the trips it summarizes actually change, keyed by
--    `signature` (a hash of the relevant trip fields) — so a Travel page load
--    never triggers a model call unless something changed.

ALTER TABLE trips ADD COLUMN IF NOT EXISTS latitude    numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS longitude   numeric;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE TABLE IF NOT EXISTS travel_brief (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief      text NOT NULL,
  signature  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS travel_brief_set_updated_at ON travel_brief;
CREATE TRIGGER travel_brief_set_updated_at
  BEFORE UPDATE ON travel_brief FOR EACH ROW EXECUTE FUNCTION set_updated_at();
