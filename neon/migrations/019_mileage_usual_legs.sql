-- 019_mileage_usual_legs.sql — Mileage: named routes behind "usual trips".
--
-- A detail popup lets John build the "usual trips" weekly total from real
-- named routes (Home → Gym, Home → Work, ...) instead of guessing one
-- aggregate number. Each leg's miles is looked up the same free, keyless
-- way the trip journal already does (lib/route-distance.js — geocode +
-- OSRM), or entered by hand when a lookup fails. The popup's "Use this
-- total" applies the computed weekly sum to mileage_settings.usual_miles /
-- usual_period — these rows are the breakdown, not a second baseline.

CREATE TABLE IF NOT EXISTS mileage_usual_legs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin          text NOT NULL,
  destination     text NOT NULL,
  miles           numeric NOT NULL,
  times_per_week  numeric NOT NULL DEFAULT 1,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
