-- 021_mileage_scenario_legs.sql — Mileage: scenarios can reference a usual-trip leg.
--
-- "What if I went to the cafe 3x/week instead of 2x?" — a scenario tied to
-- a saved usual-trip leg (migration 019) and a new times_per_week, rather
-- than a manually typed mile guess. impact_1yr/2yr/3yr on the parent row
-- are still what projectCheckpoint() reads (lib/mileage.js is unchanged);
-- these are computed server-side from the leg + the new frequency at
-- save/edit time, same linear-from-lease-start model the pace baseline
-- itself already uses. leg_id going null (the leg was deleted) leaves the
-- scenario's last-computed impacts in place — never a silent recompute to
-- zero.

ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS leg_id uuid
  REFERENCES mileage_usual_legs (id) ON DELETE SET NULL;
ALTER TABLE mileage_scenarios ADD COLUMN IF NOT EXISTS new_times_per_week numeric;
