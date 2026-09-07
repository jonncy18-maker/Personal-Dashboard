-- Trip merging: fold separate booking legs (a flight, a cruise, a hotel — each
-- scanned/entered as its own trip row) into one real trip when they're
-- actually the same journey, so PTO days, Home's trip count, and Travel Stats
-- never count the same days twice. A leg keeps its own row (its own itinerary,
-- notes, budget) but is excluded from every top-level list/summary once
-- merged_into_id is set; lib/trip-merge.js is the one pure module that
-- collapses a flat trip list into merged groups everywhere trips are counted.
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS merged_into_id uuid REFERENCES trips (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trips_merged_into_idx ON trips (merged_into_id);
