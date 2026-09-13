-- Travel history import — a one-time, resumable backfill counterpart to the
-- weekly trip-scan (003_trip_suggestions.sql). That scan only ever looks back
-- LOOKBACK_DAYS (30), by design, for ongoing detection of new bookings; John
-- asked separately to pull in years of PAST trips already in Gmail. Gmail
-- lists newest-first and a single request has a hard duration cap, so a
-- multi-year search can't finish in one round trip — this table is the
-- cursor that lets "Import Trip History" be clicked repeatedly (or hit again
-- by a retry) and pick up exactly where the last request left off, instead of
-- rescanning years of mail on every click.
--
-- Single row by construction (id fixed to 1). `queries` freezes the ordered
-- list of Gmail search strings computed when the scan starts, so a code
-- change to the term/sender lists mid-scan can't shift which query the saved
-- query_index/page_token pair refers to — a scan in progress always finishes
-- against the query set it started with; a fresh "Import Trip History" click
-- after done=true starts a new row (via upsert) with the current lists.
CREATE TABLE IF NOT EXISTS trip_history_scan (
  id             integer PRIMARY KEY DEFAULT 1,
  since_year     integer NOT NULL,
  queries        jsonb NOT NULL,
  query_index    integer NOT NULL DEFAULT 0,
  page_token     text,
  scanned_count  integer NOT NULL DEFAULT 0,
  created_count  integer NOT NULL DEFAULT 0,
  done           boolean NOT NULL DEFAULT false,
  started_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
DROP TRIGGER IF EXISTS trip_history_scan_set_updated_at ON trip_history_scan;
CREATE TRIGGER trip_history_scan_set_updated_at
  BEFORE UPDATE ON trip_history_scan FOR EACH ROW EXECUTE FUNCTION set_updated_at();
