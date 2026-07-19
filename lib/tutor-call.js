import { getDb } from './db';
import { fetchCalendarEvents } from './calendar-events';

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

// Runs over the SHARED calendar fetch (lib/calendar-events.js) rather than its
// own events.list, so the next-call lookup inherits the same linking as the
// /calendar view: events John has hidden are already filtered out (a hidden
// Spanish call won't surface here), and the returned title already honors a
// local rename. Matching itself still keys off the ORIGINAL text + organizer
// email (originalTitle, not the renamed title), so renaming a call to
// something without a Spanish keyword doesn't stop it being recognized.
async function findCalendarMatch() {
  const { events, configured, error } = await fetchCalendarEvents({
    maxResults: 50,
  });
  if (!configured) return { nextCall: null, configured: false };
  if (error) return { nextCall: null, configured: true, error };

  const match = events.find((ev) => {
    const haystack = normalizeText(
      [
        ev.originalTitle,
        ev.location,
        ev.description,
        ev.link,
        ev.organizerEmail,
        ...(ev.attendeeEmails || []),
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

  // fetchCalendarEvents already sorts by start and applies the rename, so the
  // first match is the soonest non-hidden Spanish call and match.title is the
  // renamed display title.
  return {
    nextCall: {
      id: match.id,
      title: match.title || 'Spanish tutor call',
      start: match.start,
      end: match.end,
      link: match.link,
    },
    configured: true,
  };
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
