import { getCalendarClient } from './google';
import { getDb } from './db';

// Loads every local rename override (calendar_renames) as a scope_id → title
// map. Shared so both fetchCalendarEvents (the month view + Up next feed) and
// findNextTutorCall (lib/tutor-call.js — the Spanish-call card, which does its
// own Calendar fetch) resolve renamed titles the same way; otherwise a rename
// shows on /calendar but not on the tutor-call row in Up Next / Language.
export async function getCalendarRenameMap() {
  const sql = getDb();
  const rows = await sql`SELECT scope_id, title FROM calendar_renames`;
  return new Map(rows.map((r) => [r.scope_id, r.title]));
}

// The display title for a Google event given the rename map: an
// occurrence-specific override (keyed by the event's own id) wins over a
// series-level one (keyed by recurringEventId), else the original title.
export function renamedTitle(renameMap, { id, recurringEventId, title }) {
  const override =
    renameMap.get(id) ??
    (recurringEventId ? renameMap.get(recurringEventId) : undefined);
  return override ?? title;
}

// Shared read-only Google Calendar fetch — used by both /api/calendar-events
// (the /calendar month view) and /api/home-summary (feeding non-hidden events
// into the Home hero's "Up next" agenda), so there is exactly one place that
// knows how to normalize a Calendar event, filter out what John has hidden
// (calendar_hidden), and apply a local display-title override (calendar_renames)
// — CLAUDE.md §2/§7: Calendar stays read-only, no write calls ever, so both
// are local flags in our own DB, never a write back to the real event. Fails
// soft: any Calendar API error returns an empty list rather than throwing, so
// a caller's page/section still renders.
export async function fetchCalendarEvents({
  timeMin,
  timeMax,
  maxResults = 250,
} = {}) {
  const calendar = getCalendarClient();
  if (!calendar) {
    return { events: [], configured: false };
  }

  const sql = getDb();
  const [hiddenRows, renameRows] = await Promise.all([
    sql`SELECT gcal_event_id FROM calendar_hidden`,
    sql`SELECT scope_id, title FROM calendar_renames`,
  ]);
  const hiddenIds = new Set(hiddenRows.map((r) => r.gcal_event_id));
  const renameMap = new Map(renameRows.map((r) => [r.scope_id, r.title]));

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items || [])
      .filter((e) => e.status !== 'cancelled' && !hiddenIds.has(e.id))
      .map((e) => {
        const originalTitle = e.summary || '(no title)';
        const title = renamedTitle(renameMap, {
          id: e.id,
          recurringEventId: e.recurringEventId,
          title: originalTitle,
        });
        return {
          id: e.id,
          recurringEventId: e.recurringEventId || null,
          title,
          originalTitle,
          renamed: title !== originalTitle,
          // All-day events carry start.date (a bare YYYY-MM-DD); timed
          // events carry start.dateTime (a full instant). Preserve which it
          // is so callers format/sort each correctly.
          start: e.start?.dateTime || e.start?.date || null,
          end: e.end?.dateTime || e.end?.date || null,
          allDay: Boolean(e.start?.date && !e.start?.dateTime),
          location: e.location || null,
          link: e.hangoutLink || e.htmlLink || null,
          // Match-only fields: the Spanish-tutor-call matcher (lib/tutor-call.js)
          // now runs over this shared list so it inherits hide/rename filtering,
          // but it identifies a lesson by the ORGANIZER email (some events are
          // titled just "John Shaw") + description, which the render shape above
          // drops. Carried here so there's still one Calendar read. Harmless to
          // the view (it ignores them); this is John's own private data in
          // John's own browser (single-user app — CLAUDE.md).
          description: e.description || null,
          organizerEmail: e.organizer?.email || null,
          attendeeEmails: (e.attendees || [])
            .map((a) => a.email)
            .filter(Boolean),
        };
      })
      .filter((e) => e.start);

    return { events, configured: true };
  } catch {
    return { events: [], configured: true, error: 'lookup failed' };
  }
}
