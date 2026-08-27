-- Travel Day Exclusions — a distinct section from Forecast Scenarios
-- (John's call: scenarios model hypothetical recurring routine changes;
-- this models a real, one-time fact — "I wasn't home driving these days").
-- Reviewed like Travel's Gmail trip-suggestion queue: a trip with no row
-- here yet surfaces for accept/dismiss; "accept" snapshots the current
-- baseline daily rate x day count as miles_excluded so it never silently
-- drifts if the pace later changes. trip_id is nullable so a manual entry
-- (a trip Travel doesn't track) fits the same shape; ON DELETE SET NULL
-- keeps the exclusion (and its snapshot) if the Travel trip is later deleted.
CREATE TABLE IF NOT EXISTS mileage_travel_exclusions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          uuid REFERENCES trips (id) ON DELETE SET NULL,
  label            text,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  days             integer NOT NULL,
  daily_rate_used  numeric,
  miles_excluded   numeric,
  status           text NOT NULL DEFAULT 'accepted'
                   CHECK (status IN ('accepted', 'dismissed')),
  source           text NOT NULL CHECK (source IN ('travel', 'manual')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mileage_travel_exclusions_trip_id_idx
  ON mileage_travel_exclusions (trip_id);
