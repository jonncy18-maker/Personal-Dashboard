import { getCalendarClient } from './google';
import { getDb } from './db';

// Shared read-only Google Calendar fetch — used by both /api/calendar-events
// (the /calendar month view) and /api/home-summary (feeding non-hidden events
// into the Home hero's "Up next" agenda), so there is exactly one place that
// knows how to normalize a Calendar event and filter out what John has hidden
// (calendar_hidden — CLAUDE.md §2/§7: Calendar stays read-only, no write calls
// ever). Fails soft: any Calendar API error returns an empty list rather than
// throwing, so a caller's page/section still renders.
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
  const hiddenRows = await sql`SELECT gcal_event_id FROM calendar_hidden`;
  const hiddenIds = new Set(hiddenRows.map((r) => r.gcal_event_id));

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
      .map((e) => ({
        id: e.id,
        title: e.summary || '(no title)',
        // All-day events carry start.date (a bare YYYY-MM-DD); timed events
        // carry start.dateTime (a full instant). Preserve which it is so
        // callers format/sort each correctly.
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        location: e.location || null,
        link: e.hangoutLink || e.htmlLink || null,
      }))
      .filter((e) => e.start);

    return { events, configured: true };
  } catch {
    return { events: [], configured: true, error: 'lookup failed' };
  }
}
