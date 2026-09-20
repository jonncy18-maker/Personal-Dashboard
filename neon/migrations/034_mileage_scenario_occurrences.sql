-- Scenario Realization (migration 034) — a one-time scenario ("5 round trips
-- to Morehead, Sep'26-May'27") lands its full flat one_time_miles once its
-- window closes, with no idea whether some of those trips already happened
-- and are sitting in the real odometer log. That's a real double-count: the
-- realized trip is counted once as actual driving (baked into the pace
-- baseline) and again as still-forecast scenario mileage.
--
-- occurrence_count is the total planned trips a one-time scenario represents
-- (nullable — existing scenarios are untouched until John sets one).
-- realized_count is how many of those have actually happened, incremented
-- one at a time via the new /realize endpoint, never hand-typed. Once a
-- count is set, lib/mileage.js scales one_time_miles by the unrealized
-- fraction instead of landing the flat total. Neither column touches the
-- scenario's own stored one_time_miles/dates.
ALTER TABLE mileage_scenarios
  ADD COLUMN IF NOT EXISTS occurrence_count integer;
ALTER TABLE mileage_scenarios
  ADD COLUMN IF NOT EXISTS realized_count integer NOT NULL DEFAULT 0;
