-- 020_mileage_places.sql — Mileage: named favorite places (Home, Gym, Work, ...).
--
-- The trip journal and "usual trips" route popup default an origin/
-- destination to labels like "Home" or "Gym" — words Nominatim can't
-- geocode as literal text, so every such lookup silently fell back to
-- manual mile entry. A saved place pairs a label with a real address,
-- geocoded and cached once at save time; a trip/leg typed with a matching
-- label (case-insensitive) resolves against the cached coordinates
-- automatically instead of geocoding the bare label.

CREATE TABLE IF NOT EXISTS mileage_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label       text NOT NULL UNIQUE,
  address     text NOT NULL,
  lat         numeric,
  lng         numeric,
  created_at  timestamptz NOT NULL DEFAULT now()
);
