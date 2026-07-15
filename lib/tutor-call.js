import { getCalendarClient } from './google';
import { getDb } from './db';

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

async function findCalendarMatch() {
  const calendar = getCalendarClient();
  if (!calendar) {
    return { nextCall: null, configured: false };
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
      return { nextCall: null, configured: true };
    }

    return {
      nextCall: {
        id: match.id,
        title: match.summary || 'Spanish tutor call',
        start: match.start?.dateTime || match.start?.date || null,
        end: match.end?.dateTime || match.end?.date || null,
        link: match.hangoutLink || match.htmlLink || null,
      },
      configured: true,
    };
  } catch {
    return { nextCall: null, configured: true, error: 'lookup failed' };
  }
}

// The soonest italki booking John has approved out of the weekly Gmail scan
// (app/api/language-scan) — the one gap Calendar can't cover, since italki
// lessons never create a Calendar event on their own. See ROADMAP 2026-07-15.
async function findApprovedLanguageCall() {
  const sql = getDb();
  const [row] = await sql`
    SELECT id, tutor, start_at
    FROM language_calls
    WHERE status = 'approved' AND start_at > now()
    ORDER BY start_at ASC
    LIMIT 1
  `;
  if (!row) return null;
  return {
    id: `italki-${row.id}`,
    title: row.tutor ? `Spanish lesson with ${row.tutor}` : 'Spanish lesson',
    start: row.start_at,
    end: null,
    link: null,
  };
}

// Shared by /api/calendar (Language page's own card) and /api/home-summary
// (Home + Sidebar + TopBar) so every caller resolves "next call" the same
// way: whichever of the Calendar match or an approved italki suggestion is
// sooner.
export async function findNextTutorCall() {
  const [calendarResult, languageCall] = await Promise.all([
    findCalendarMatch(),
    findApprovedLanguageCall(),
  ]);

  const candidates = [calendarResult.nextCall, languageCall].filter(Boolean);
  candidates.sort((a, b) => new Date(a.start) - new Date(b.start));

  return {
    nextCall: candidates[0] || null,
    configured: calendarResult.configured,
    error: calendarResult.error,
  };
}
