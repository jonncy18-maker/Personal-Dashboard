import { getCalendarClient } from '../../../lib/google';

// Read-only. Finds the next Spanish tutor call by a plain keyword/host match
// — no AI (CLAUDE.md Language). John books through more than one tutor and
// their event titles are inconsistent (some say "Español (n/10 John Shaw)",
// some say "CLASE n/5 JOHN KENTUCKY", one says just "John Shaw" with the only
// signal being the organizer's email address, mucho.spanish.bruno@gmail.com).
// So the "host match" the spec describes has to include the organizer and
// attendee emails, not just the title/location/description. Diacritics are
// stripped before matching so "español" and "espanol" both hit.
const TUTOR_KEYWORDS = ['italki', 'espanol', 'spanish', 'clase'];

function stripDiacritics(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export async function GET() {
  const calendar = getCalendarClient();
  if (!calendar) {
    return Response.json({ nextCall: null, configured: false });
  }

  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = res.data.items || [];
    const match = events.find((event) => {
      const haystack = stripDiacritics(
        [
          event.summary,
          event.location,
          event.description,
          event.hangoutLink,
          event.organizer?.email,
          ...(event.attendees || []).map((a) => a.email),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
      );
      return TUTOR_KEYWORDS.some((keyword) => haystack.includes(keyword));
    });

    if (!match) {
      return Response.json({ nextCall: null, configured: true });
    }

    return Response.json({
      nextCall: {
        id: match.id,
        title: match.summary || 'Spanish tutor call',
        start: match.start?.dateTime || match.start?.date || null,
        end: match.end?.dateTime || match.end?.date || null,
        link: match.hangoutLink || match.htmlLink || null,
      },
      configured: true,
    });
  } catch {
    return Response.json(
      { nextCall: null, configured: true, error: 'lookup failed' },
      { status: 502 }
    );
  }
}
