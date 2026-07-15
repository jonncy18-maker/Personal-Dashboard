-- 004_language_calls.sql — Language: weekly Gmail italki-booking auto-detection.
--
-- Same review-queue shape as 003_trip_suggestions, applied to the one real gap
-- in Language's Calendar-only "next tutor call" card: italki lessons don't
-- create Calendar events at all (they happen in italki's own in-app
-- classroom), so John has had to manually "Add to calendar" from the
-- confirmation email before. A weekly scan (app/api/language-scan) finds those
-- confirmation emails and proposes them here as PENDING; John Approves (the
-- row becomes the record itself — no other table to write to) or Dismisses.
--
-- Deliberately NO AI: every italki "lesson request accepted" email is the same
-- fixed template from the same sender, with the date/time in a labeled
-- "Lesson Date/Time:" line — a deterministic regex parse is exact and free,
-- the same reasoning CLAUDE.md §7 applies to Email Tier 1's sender-header
-- parse. See ROADMAP 2026-07-15 for the email samples this was verified
-- against. (The other two tutors already flow through Calendar directly and
-- need no wiring here — see the Calendar match history in ROADMAP.)
CREATE TABLE IF NOT EXISTS language_calls (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor            text,
  start_at         timestamptz NOT NULL,
  source_gmail_id  text UNIQUE,     -- the Gmail message this came from (dedupe key)
  source_subject   text,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'dismissed')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS language_calls_status_idx ON language_calls (status);
DROP TRIGGER IF EXISTS language_calls_set_updated_at ON language_calls;
CREATE TRIGGER language_calls_set_updated_at
  BEFORE UPDATE ON language_calls FOR EACH ROW EXECUTE FUNCTION set_updated_at();
