-- 009_trip_wishlist_status.sql — Travel: add a 'wishlist' trip status.
--
-- The Trip Collection gains an Upcoming / Past / Wishlist split. A wishlist
-- trip is a someday/maybe destination — no committed dates required — distinct
-- from 'upcoming' (booked/planned) and 'past' (completed). Widen the status
-- CHECK to allow it. Idempotent: drop the auto-named inline constraint if
-- present, then re-add it with the new value set.

ALTER TABLE trips DROP CONSTRAINT IF EXISTS trips_status_check;
ALTER TABLE trips ADD CONSTRAINT trips_status_check
  CHECK (status IN ('upcoming', 'past', 'wishlist'));
