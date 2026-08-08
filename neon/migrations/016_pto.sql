-- PTO Planner — see PTO_BUILD_PLAN.md (deleted after build; content lives on
-- in the 2026-08-08 ROADMAP.md entry). Self-set 25-day annual budget (no
-- accrual — CrossCountry PTO is unlimited), reset each calendar year. Days
-- auto-derive from trips (weekdays minus firm holidays), with per-trip
-- overrides and rare manual entries. A separate banked-holiday ledger and a
-- read-only simulation layer (wishlist what-ifs, sandbox, saved scenarios)
-- sit on top — neither is ever blended into the real PTO number.

-- Singleton settings row (same pattern as french_hours_summary's singleton).
CREATE TABLE IF NOT EXISTS pto_settings (
  id            smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  annual_budget integer NOT NULL DEFAULT 25,  -- John's target, not an employer number
  updated_at    timestamptz NOT NULL DEFAULT now()
);
INSERT INTO pto_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Firm holidays, editable in-app. `worked` feeds the banked counter. Stored
-- as the observed weekday date (see PTO_BUILD_PLAN.md §2) — the app never
-- needs Saturday/Sunday observance math.
CREATE TABLE IF NOT EXISTS pto_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name         text NOT NULL,
  worked       boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Manual whole-day entries. kind='pto' = a non-trip PTO day;
-- kind='banked_spend' = spending one banked holiday on that date.
CREATE TABLE IF NOT EXISTS pto_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('pto', 'banked_spend')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entry_date, kind)
);

-- Saved simulation scenarios. Items are references + ranges only; costs are
-- always computed live against the chosen year's holidays, never stored.
-- item shapes: {kind:'wishlist_trip', trip_id} — a dated wishlist trip —
--          or  {kind:'range', label, start_date, end_date} — an ad-hoc range.
CREATE TABLE IF NOT EXISTS pto_scenarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  items      jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Per-trip corrections. An override sticks — auto math never overwrites it
-- (same discipline as trips.image_source = 'manual').
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pto_days_override integer;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pto_exempt boolean NOT NULL DEFAULT false;

-- Seed CrossCountry's 2026 firm holidays (confirmed by John 2026-08-08).
-- Independence Day observed Fri Jul 3 (Jul 4 falls on a Saturday in 2026;
-- firm convention: Saturday holiday -> prior Friday, Sunday -> following Monday).
INSERT INTO pto_holidays (holiday_date, name) VALUES
  ('2026-01-01', 'New Year''s Day'),
  ('2026-01-19', 'MLK Day'),
  ('2026-05-25', 'Memorial Day'),
  ('2026-06-19', 'Juneteenth'),
  ('2026-07-03', 'Independence Day (observed)'),
  ('2026-09-07', 'Labor Day'),
  ('2026-11-26', 'Thanksgiving Day'),
  ('2026-11-27', 'Day after Thanksgiving'),
  ('2026-12-25', 'Christmas Day')
ON CONFLICT (holiday_date) DO NOTHING;
