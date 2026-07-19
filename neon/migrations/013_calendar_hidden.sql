-- 013_calendar_hidden.sql — hide individual events from the /calendar view.
--
-- Same shape as email_hidden (CLAUDE.md §7): Google Calendar is read-only
-- (§2/§7 — no write/modify/delete calls, ever), so "hiding" an event only
-- sets a local flag here. The real calendar event is never touched.
--
-- Title/start are snapshotted at hide time so the "Hidden events" management
-- popup can list something meaningful without a second live Calendar call —
-- same reasoning as email_todos's snapshot.
--
-- Recurring events are expanded by singleEvents:true before /api/calendar-events
-- ever sees them, so each occurrence has its own instance id and this hides
-- exactly the occurrence John hid, not the whole series.

CREATE TABLE IF NOT EXISTS calendar_hidden (
  gcal_event_id  text PRIMARY KEY,
  title          text,
  start_label    text,
  hidden_at      timestamptz NOT NULL DEFAULT now()
);
