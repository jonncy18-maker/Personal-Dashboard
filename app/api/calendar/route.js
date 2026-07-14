import { getCalendarClient } from '../../../lib/google';

// Read-only. Finds the next Spanish tutor call by a plain keyword/host match
// in the event title, location, or description — no AI (CLAUDE.md Language).
// "italki" was the spec's example host; John's actual bookings come through a
// different tutor and are titled "Español (n/10 John Shaw)", so match on the
// language name too. Diacritics are stripped before matching so "español" and
// "espanol" both hit.
const TUTOR_KEYWORDS = ['italki', 'espanol', 'spanish'];

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
        [event.summary, event.location, event.description, event.hangoutLink]
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
