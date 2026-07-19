import { fetchCalendarEvents } from '../../../lib/calendar-events';

// Read-only Google Calendar window for the /calendar month view. External
// source → fails soft (CLAUDE.md §7): any error returns the success shape with
// an empty list so the calendar renders its grid, never a broken page. No
// write/modify calls, ever — same read-only boundary as the tutor-call lookup.
// Events John has hidden (calendar_hidden, see 013_calendar_hidden.sql) are
// filtered out by the shared fetchCalendarEvents() helper (lib/calendar-events.js)
// — the same helper /api/home-summary uses to feed the Home hero's "Up next"
// agenda, so both surfaces agree on what's hidden.
//
// Query params `from`/`to` are inclusive/exclusive ISO date bounds (the month
// the client is viewing, padded to whole weeks). Defaults to a ~35-day window
// from today if omitted.
export async function GET(request) {
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

  const result = await fetchCalendarEvents({ timeMin, timeMax });
  if (result.error) {
    return Response.json(result, { status: 502 });
  }
  return Response.json(result);
}
