-- Step count joins weight on the same dated-reading row (one manual metric
-- log per day, not two parallel tables) — logging steps for a day that
-- hasn't been weighed yet, or vice versa, must not require the other.
-- weight_lb therefore has to stop being NOT NULL: a steps-only day is a real
-- row with no weight in it.
--
-- Deliberately NOT fed into any calorie math (CLAUDE.md's health skill,
-- "deferred to v2" list) — wearables overestimate active burn by a
-- well-documented 20-40%, and Mifflin-St Jeor's activity multiplier already
-- assumes a general activity level, so crediting steps back intraday would
-- double-count. This is a display/log-only metric until that's revisited
-- deliberately, not an oversight.
ALTER TABLE health_weight_readings ALTER COLUMN weight_lb DROP NOT NULL;
ALTER TABLE health_weight_readings ADD COLUMN IF NOT EXISTS steps integer CHECK (steps >= 0);
