import { getCalendarClient } from '../../../lib/google';

// Read-only. Finds the next Spanish tutor call by a plain keyword/host match
// — no AI (CLAUDE.md Language). John books through three different tutors and
// their event titles are inconsistent: "Español (n/10 John Shaw)", "CLASE n/5
// JOHN KENTUCKY", just "John Shaw" (the only signal is the organizer's email,
// mucho.spanish.bruno@gmail.com), and — for italki lessons manually added to
// Calendar from Gmail's "Add to calendar" — a truncated title in stylized
// Unicode letters, e.g. "with 𝐃𝐀𝐍𝐈✨ ( Estudiantes avanzados B1-C2)". So the
// "host match" the spec describes has to include the organizer/attendee
// emails, not just the title/location/description; text is NFKC-normalized
// first to fold stylized Unicode letters (𝐒𝐏𝐀𝐍𝐈𝐒𝐇 → SPANISH) before
// diacritics are stripped (so "español" and "espanol" both hit).
const TUTOR_KEYWORDS = ['italki', 'espanol', 'spanish', 'clase', 'estudiantes'];

function normalizeText(text) {
  return text.normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '');
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
      const haystack = normalizeText(
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
