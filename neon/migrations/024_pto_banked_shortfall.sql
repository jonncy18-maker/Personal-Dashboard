-- Adds an explicit, John-controlled opt-in for whether banked holidays cover
-- a PTO shortfall in the headline "net" figure. Defaults to false so nothing
-- changes for an existing install until John turns it on from the new
-- Planning sub-tab — the banked ledger stays fully separate either way; this
-- only decides whether its `available` count is added into the displayed
-- net figure, never into the underlying taken/planned/left accounting.
ALTER TABLE pto_settings
  ADD COLUMN IF NOT EXISTS use_banked_for_shortfall boolean NOT NULL DEFAULT false;
