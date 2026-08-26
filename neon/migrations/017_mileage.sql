-- Mileage calculator (7th domain, /mileage) — Tesla lease tracker/forecaster.
-- See ROADMAP.md's 2026-08-26 scoping entry. Lease fields are nullable: a
-- fresh install has no lease info yet, and the page shows an honest "set up
-- your lease" state rather than computing against fabricated defaults.

CREATE TABLE IF NOT EXISTS mileage_settings (
  id                      smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lease_start_date        date,
  lease_term_months       integer NOT NULL DEFAULT 36,
  annual_allowance_miles  integer NOT NULL DEFAULT 10000,
  overage_rate_cents      integer NOT NULL DEFAULT 25,  -- cents per mile
  starting_odometer       integer,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
INSERT INTO mileage_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
DROP TRIGGER IF EXISTS mileage_settings_set_updated_at ON mileage_settings;
CREATE TRIGGER mileage_settings_set_updated_at
  BEFORE UPDATE ON mileage_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Dated odometer log — the ground truth for cumulative miles driven. Trip
-- log entries (below) are a supplementary journal, never summed into this.
CREATE TABLE IF NOT EXISTS mileage_readings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_date  date NOT NULL UNIQUE,
  odometer      integer NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Point-to-point trip journal. miles is geocoded + routed via OSRM at save
-- time (lib/route-distance.js) when available, or entered by hand when a
-- lookup fails — either way it's cached on the row, never recomputed.
CREATE TABLE IF NOT EXISTS mileage_trips (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date        date,
  origin           text NOT NULL,
  destination      text NOT NULL,
  origin_lat       numeric,
  origin_lng       numeric,
  destination_lat  numeric,
  destination_lng  numeric,
  miles            numeric NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mileage_trips_date_idx ON mileage_trips (trip_date DESC);

-- Named forecast scenarios. John picks which are `active` — only active
-- scenarios' impact is added to a checkpoint's projection (lib/mileage.js);
-- unchecked ones stay saved but excluded, never silently blended in.
CREATE TABLE IF NOT EXISTS mileage_scenarios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  note        text,
  active      boolean NOT NULL DEFAULT false,
  impact_1yr  integer NOT NULL DEFAULT 0,
  impact_2yr  integer NOT NULL DEFAULT 0,
  impact_3yr  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS mileage_scenarios_set_updated_at ON mileage_scenarios;
CREATE TRIGGER mileage_scenarios_set_updated_at
  BEFORE UPDATE ON mileage_scenarios FOR EACH ROW EXECUTE FUNCTION set_updated_at();
