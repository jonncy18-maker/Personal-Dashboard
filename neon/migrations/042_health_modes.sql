-- Food modes: cut / maintain / build.
--
-- One profile, three ways of computing the daily target. Logging, weight,
-- steps and water are identical in every mode; only the target and which
-- number leads the page change.
--
--   cut      today's behavior (goal weight + goal date), plus a max loss rate:
--            a goal date that would need a faster loss than the cap slips the
--            DATE instead of bending the target.
--   maintain maintenance calories (maintain_cal_manual, else the formula)
--            +/- maintain_band_pct. The target is a range, not a point.
--   build    maintenance + a surplus (build_surplus_pct, held under
--            max_gain_pct_per_week), with a protein target of
--            protein_g_per_lb x weight.
--
-- Default mode is 'cut' so an existing profile keeps its goal and behavior.
-- The caps are nullable on purpose: NULL means "no cap", an explicit override.
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS mode text
  NOT NULL DEFAULT 'cut' CHECK (mode IN ('cut', 'maintain', 'build'));
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS max_loss_pct_per_week numeric(3, 2)
  DEFAULT 1.00 CHECK (max_loss_pct_per_week > 0 AND max_loss_pct_per_week <= 5);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS maintain_cal_manual integer
  CHECK (maintain_cal_manual > 0);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS maintain_band_pct numeric(4, 1)
  NOT NULL DEFAULT 5 CHECK (maintain_band_pct >= 0 AND maintain_band_pct <= 25);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS maintain_weight_lb numeric(5, 1)
  CHECK (maintain_weight_lb > 0);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS build_surplus_pct numeric(4, 1)
  NOT NULL DEFAULT 10 CHECK (build_surplus_pct > 0 AND build_surplus_pct <= 30);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS max_gain_pct_per_week numeric(3, 2)
  DEFAULT 0.50 CHECK (max_gain_pct_per_week > 0 AND max_gain_pct_per_week <= 2);
ALTER TABLE health_profile ADD COLUMN IF NOT EXISTS protein_g_per_lb numeric(3, 2)
  NOT NULL DEFAULT 0.80 CHECK (protein_g_per_lb > 0 AND protein_g_per_lb <= 2);
