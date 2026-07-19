-- 014_calendar_renames.sql — locally rename an event (or a whole recurring
-- series) on the /calendar view, without touching Google Calendar.
--
-- Same read-only boundary as calendar_hidden (CLAUDE.md §2/§7): the real
-- calendar event's title is never modified, only its display title in this
-- dashboard.
--
-- `scope_id` is either the event's own Google id ("just this event") or its
-- recurringEventId ("the whole series" — every expanded occurrence of a
-- recurring event shares the same recurringEventId, so one row overrides all
-- of them). `scope` records which kind of id it is, purely for the "Renamed
-- events" management popup to label rows sensibly; the actual override
-- behavior is driven entirely by which id was used as the key.

CREATE TABLE IF NOT EXISTS calendar_renames (
  scope_id    text PRIMARY KEY,
  scope       text NOT NULL CHECK (scope IN ('event', 'series')),
  title       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS calendar_renames_set_updated_at ON calendar_renames;
CREATE TRIGGER calendar_renames_set_updated_at
  BEFORE UPDATE ON calendar_renames FOR EACH ROW EXECUTE FUNCTION set_updated_at();
