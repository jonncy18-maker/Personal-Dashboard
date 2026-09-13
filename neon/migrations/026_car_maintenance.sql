-- Car maintenance (the /car domain's second tab) — a service schedule whose
-- due points are read off the existing odometer log, never a second pace.
-- See ROADMAP.md's 2026-09-13 scoping entry.
--
-- The vehicle profile extends mileage_settings rather than adding a table:
-- this domain already assumes one car and one lease (mileage_settings is a
-- singleton, id = 1). Multi-car stays unbuilt until it's actually wanted.
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS vehicle_make text;
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS vehicle_model text;
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS vehicle_year integer;
ALTER TABLE mileage_settings ADD COLUMN IF NOT EXISTS vehicle_trim text;

-- The schedule. Both intervals are nullable and at least one is required at
-- the API boundary — EXCEPT that a row sourced from the manufacturer may
-- legitimately have neither: the Model 3 manual's "Brake fluid health check
-- every  years" states no number at all, so that row is stored with a null
-- interval and rendered as "interval not stated in source" rather than
-- back-filled with a guess.
--
-- `source` records where the interval came from and is never inferred:
--   official — from the manufacturer's published schedule (source_url set)
--   starter  — an unverified built-in default, shown as such until confirmed
--   manual   — typed by John
--
-- `condition_note` carries a trigger the app CANNOT compute — tire tread
-- depth, or "only if roads are salted in winter". It is displayed on the row
-- as a stated condition and never turned into a due date.
CREATE TABLE IF NOT EXISTS maintenance_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  interval_miles     integer,
  interval_months    integer,
  condition_note     text,
  active             boolean NOT NULL DEFAULT true,
  source             text NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('official', 'starter', 'manual')),
  source_url         text,
  source_fetched_at  timestamptz,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS maintenance_items_set_updated_at ON maintenance_items;
CREATE TRIGGER maintenance_items_set_updated_at
  BEFORE UPDATE ON maintenance_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One row per completed service. "Last done" is simply the latest row for an
-- item, which is why rolling an item forward to its next period needs no
-- extra state on the item itself.
--
-- `odometer` is recorded here and is NOT written into mileage_readings — that
-- log stays the single ground truth for cumulative miles (see the `car`
-- skill). A check-off may ALSO insert a mileage_readings row, but only when
-- John explicitly opts in at confirm time.
CREATE TABLE IF NOT EXISTS maintenance_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES maintenance_items (id) ON DELETE CASCADE,
  service_date  date NOT NULL,
  odometer      integer,
  cost_cents    integer,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS maintenance_records_item_idx
  ON maintenance_records (item_id, service_date DESC);
