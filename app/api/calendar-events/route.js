import { getCalendarClient } from '../../../lib/google';

// Read-only Google Calendar window for the /calendar month view. External
// source → fails soft (CLAUDE.md §7): any error returns the success shape with
// an empty list so the calendar renders its grid, never a broken page. No
// write/modify calls, ever — same read-only boundary as the tutor-call lookup.
//
// Query params `from`/`to` are inclusive/exclusive ISO date bounds (the month
// the client is viewing, padded to whole weeks). Defaults to a ~35-day window
// from today if omitted.
export async function GET(request) {
  const calendar = getCalendarClient();
  if (!calendar) {
    return Response.json({ events: [], configured: false });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const timeMin = from
    ? new Date(`${from}T00:00:00`).toISOString()
    : now.toISOString();
  const timeMax = to
    ? new Date(`${to}T00:00:00`).toISOString()
    : new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 250,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items || [])
      .filter((e) => e.status !== 'cancelled')
      .map((e) => ({
        id: e.id,
        title: e.summary || '(no title)',
        // All-day events carry start.date (a bare YYYY-MM-DD); timed events
        // carry start.dateTime (a full instant). Preserve which it is so the
        // client formats/positions each correctly.
        start: e.start?.dateTime || e.start?.date || null,
        end: e.end?.dateTime || e.end?.date || null,
        allDay: Boolean(e.start?.date && !e.start?.dateTime),
        location: e.location || null,
        link: e.hangoutLink || e.htmlLink || null,
      }))
      .filter((e) => e.start);

    return Response.json({ events, configured: true });
  } catch {
    return Response.json(
      { events: [], configured: true, error: 'lookup failed' },
      { status: 502 }
    );
  }
}
