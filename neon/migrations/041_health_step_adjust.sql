-- Opt-in prior-day step adjustment for the daily calorie target.
--
-- When enabled, computeTarget() moves the day's target by how far YESTERDAY's
-- logged steps landed from the trailing average (ending the day before
-- yesterday), converted to calories with the ACSM walking equation and
-- multiplied by step_adjust_pct. It is additive on top of the activity
-- multiplier and applies only the DEVIATION from usual, so the multiplier's
-- baseline is never double-counted. Today's own steps are never read — no
-- intraday credit, same rule as the trailing multiplier (migration 031).
--
-- Off by default: nothing changes for a profile that never opts in.
-- step_adjust_pct is the fraction of the estimated burn credited back; the
-- ceiling of 1 means "credit all of it", never more.
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS step_adjust_enabled boolean
  NOT NULL DEFAULT false;
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS step_adjust_pct numeric(3, 2)
  NOT NULL DEFAULT 0.50 CHECK (step_adjust_pct > 0 AND step_adjust_pct <= 1);
