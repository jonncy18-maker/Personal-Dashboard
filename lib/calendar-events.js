import { getCalendarClient } from './google';
import { getDb } from './db';

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
        // A local rename can target just this occurrence (keyed by the
        // event's own id) or the whole recurring series (keyed by
        // recurringEventId, shared by every expanded occurrence) — an
        // occurrence-specific override wins if both exist.
        const overrideTitle =
          renameMap.get(e.id) ??
          (e.recurringEventId ? renameMap.get(e.recurringEventId) : undefined);
        return {
          id: e.id,
          recurringEventId: e.recurringEventId || null,
          title: overrideTitle ?? originalTitle,
          originalTitle,
          renamed: overrideTitle != null,
          // All-day events carry start.date (a bare YYYY-MM-DD); timed
          // events carry start.dateTime (a full instant). Preserve which it
          // is so callers format/sort each correctly.
          start: e.start?.dateTime || e.start?.date || null,
          end: e.end?.dateTime || e.end?.date || null,
          allDay: Boolean(e.start?.date && !e.start?.dateTime),
          location: e.location || null,
          link: e.hangoutLink || e.htmlLink || null,
        };
      })
      .filter((e) => e.start);

    return { events, configured: true };
  } catch {
    return { events: [], configured: true, error: 'lookup failed' };
  }
}
