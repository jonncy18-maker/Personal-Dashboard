import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { header } from '../../../lib/email-sender';
import { extractPlainText } from '../../../lib/gmail-body';
import { meaningfulWords } from '../../../lib/destination';
import { detectTripFromEmail } from '../../../lib/trip-detect';

// Weekly Gmail trip auto-detection (CLAUDE.md §7). Read-only Gmail, same hard
// boundary as Email/itinerary-import. Deterministic search finds candidate
// booking emails from the last 30 days; Haiku (lib/trip-detect) decides which
// are real trips and extracts destination + dates; each new one is stored as a
// PENDING trip_suggestion for John to Approve or Dismiss. Never auto-creates a
// trip. Runs on a weekly Vercel Cron (GET) and on the manual "Scan now" button
// (POST) — both call runScan().

// High-precision travel PHRASES, not bare words. The scan has no destination to
// anchor on (it's discovering trips), so bare "booking"/"confirmation"/
// "reservation" matched every order receipt, bank alert, and personal email —
// which both wasted Haiku calls and (Gmail returns newest-first) pushed real
// older confirmations past the candidate cap. Verified against a real inbox:
// this cut a 30-day match set from ~200 to ~50 and surfaced a Singapore Airlines
// booking that the bare-word query had truncated. (Distinct from travel-import's
// terms, which can stay broad because a destination narrows them.)
const SEARCH_TERMS = [
  '"booking confirmation"',
  '"flight confirmation"',
  '"trip confirmation"',
  '"travel confirmation"',
  '"reservation confirmation"',
  '"hotel confirmation"',
  '"cruise confirmation"',
  '"e-ticket"',
  '"boarding pass"',
  '"your itinerary"',
  '"travel itinerary"',
  '"flight itinerary"',
  'itinerary',
];
const LOOKBACK_DAYS = 30;
const MAX_CANDIDATES = 40; // headroom so real confirmations aren't truncated
const MIN_CONFIDENCE = 0.6;

function lookbackQuery() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, '0');
  const d = String(since.getDate()).padStart(2, '0');
  const keywords = `(${SEARCH_TERMS.join(' OR ')})`;
  return `${keywords} after:${y}/${m}/${d} -category:promotions -category:social`;
}

// Skip a candidate if an existing trip plainly covers it: dates overlap AND the
// destinations share a real place-word. Coarse on purpose — a false "already
// have it" only means one fewer suggestion, which John can still add manually.
function matchesExistingTrip(cand, trips) {
  const candWords = new Set(
    meaningfulWords(cand.destination).map((w) => w.toLowerCase())
  );
  return trips.some((t) => {
    const shareWord = meaningfulWords(t.destination).some((w) =>
      candWords.has(w.toLowerCase())
    );
    if (!shareWord) return false;
    if (!cand.start_date || !t.start_date) return true; // shared place, no dates to separate them
    const cs = cand.start_date;
    const ce = cand.end_date || cand.start_date;
    const ts = t.start_date;
    const te = t.end_date || t.start_date;
    return cs <= te && ts <= ce; // range overlap
  });
}

async function runScan() {
  const gmail = getGmailClient();
  if (!gmail) return { configured: false, scanned: 0, created: 0 };

  const sql = getDb();
  const [seenRows, trips] = await Promise.all([
    sql`SELECT source_gmail_id FROM trip_suggestions WHERE source_gmail_id IS NOT NULL`,
    sql`SELECT destination, start_date, end_date FROM trips`,
  ]);
  const seen = new Set(seenRows.map((r) => r.source_gmail_id));

  const list = await gmail.users.messages.list({
    userId: 'me',
    q: lookbackQuery(),
    maxResults: MAX_CANDIDATES,
  });
  const ids = (list.data.messages || []).filter((m) => !seen.has(m.id));

  let created = 0;
  for (const { id } of ids) {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    const subject = header(res.data.payload?.headers, 'Subject');
    const body = extractPlainText(res.data.payload);

    const trip = await detectTripFromEmail({ subject, body });
    if (!trip || trip.confidence < MIN_CONFIDENCE || !trip.start_date) continue;
    if (matchesExistingTrip(trip, trips)) continue;

    // ON CONFLICT guards the unique source_gmail_id in case of a concurrent run.
    const inserted = await sql`
      INSERT INTO trip_suggestions
        (destination, start_date, end_date, source_gmail_id, source_subject, raw)
      VALUES (
        ${trip.destination}, ${trip.start_date}, ${trip.end_date}, ${id},
        ${subject || null}, ${JSON.stringify(trip)}::jsonb
      )
      ON CONFLICT (source_gmail_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length) created++;
  }

  return { configured: true, scanned: ids.length, created };
}

// GET is the Vercel Cron entry point. When CRON_SECRET is set, Vercel sends it
// as a Bearer token — require it so the (AI-costing) scan can't be triggered by
// a stray public GET. POST is the same-origin "Scan now" button (this is a
// single-user private app, gated at the Vercel project level).
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  try {
    return Response.json(await runScan());
  } catch {
    return Response.json({ error: 'scan failed' }, { status: 502 });
  }
}

export async function POST() {
  try {
    return Response.json(await runScan());
  } catch {
    return Response.json({ error: 'scan failed' }, { status: 502 });
  }
}
