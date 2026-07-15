-- 003_trip_suggestions.sql — Travel: weekly Gmail trip auto-detection.
-- A weekly scan (app/api/trip-scan) searches Gmail read-only for likely new
-- trips, Haiku extracts destination + dates, and each candidate is stored here
-- as a PENDING suggestion. John reviews and Approves (creates a real trip) or
-- Dismisses (remembered so it never re-appears). Nothing is auto-created — the
-- human gate is the point (see ROADMAP 2026-07-15 scoping entry, CLAUDE.md §7).

CREATE TABLE IF NOT EXISTS trip_suggestions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination      text NOT NULL,
  start_date       date,
  end_date         date,
  source_gmail_id  text UNIQUE,     -- the Gmail message this came from (dedupe key)
  source_subject   text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'dismissed')),
  raw              jsonb,           -- Haiku's raw extraction, for the review preview
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trip_suggestions_status_idx ON trip_suggestions (status);
DROP TRIGGER IF EXISTS trip_suggestions_set_updated_at ON trip_suggestions;
CREATE TRIGGER trip_suggestions_set_updated_at
  BEFORE UPDATE ON trip_suggestions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
