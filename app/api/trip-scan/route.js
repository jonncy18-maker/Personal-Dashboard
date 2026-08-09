import { getDb, dateOnly } from '../../../lib/db';
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

// A full scan is several Gmail lists + up to MAX_CANDIDATES fetch+Haiku rounds
// — well past Vercel's 10s default function duration.
export const maxDuration = 60;

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
// Travel brands whose booking-bearing mail arrives through their MARKETING
// stream, so Gmail files it under category:promotions — which the primary
// query below deliberately excludes. Surfaced 2026-08-09: John's booked
// Celebrity Beyond sailing (Dec 20, 2026) was invisible to every scan, because
// the only emails referencing it are Celebrity's own sale emails, each
// carrying a real reservation block ("We look forward to seeing you on board
// … on December 20, 2026", Booking #). Verified against the live mailbox: the
// primary query returns ZERO Celebrity threads, the same query without
// -category:promotions returns 19. So promotions stay excluded in general
// (that exclusion is what keeps the candidate set ~50 instead of ~200), and
// these senders are queried separately as an allowlist.
const TRAVEL_SENDER_DOMAINS = [
  'celebritycruises.com',
  'royalcaribbean.com',
  'royalcaribbeanmarketing.com',
  'princess.com',
  'hollandamerica.com',
  'ncl.com',
  'carnival.com',
  'virginvoyages.com',
  'vikingcruises.com',
  'expediacruises.com',
  'delta.com',
  'aa.com',
  'united.com',
  'southwest.com',
  'flybreeze.com',
  'marriott.com',
  'hilton.com',
  'booking.com',
  'expedia.com',
  'airbnb.com',
];

const LOOKBACK_DAYS = 30;
const MAX_CANDIDATES = 40; // headroom so real confirmations aren't truncated
// Per-brand cap on the allowlist pass. A cruise line re-sends the same
// reservation block in every sale email (Celebrity: 37 threads in 30 days), so
// the newest few are plenty — and without a cap one chatty brand would eat the
// whole candidate budget and truncate everything else, the exact failure the
// SEARCH_TERMS comment above describes.
const MAX_PER_TRAVEL_SENDER = 3;
const MAX_TRAVEL_CANDIDATES = 15; // slots reserved for the allowlist pass
const DETECT_CONCURRENCY = 4; // Haiku calls in flight (keeps the run inside maxDuration)
const MIN_CONFIDENCE = 0.6;
// The reservation block sits at the BOTTOM of these marketing emails — measured
// at char 10,233 of 13,509 in the real Celebrity email — so the shared 12k
// default would clip it on any slightly longer sibling. Scan-only widening.
const BODY_LIMIT = 20000;

function sinceStamp() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, '0');
  const d = String(since.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

function lookbackQuery() {
  const keywords = `(${SEARCH_TERMS.join(' OR ')})`;
  return `${keywords} after:${sinceStamp()} -category:promotions -category:social`;
}

// Same keywords, one trusted sender, no category exclusion.
function travelSenderQuery(domain) {
  const keywords = `(${SEARCH_TERMS.join(' OR ')})`;
  return `${keywords} after:${sinceStamp()} from:${domain}`;
}

// A dead/revoked GOOGLE_REFRESH_TOKEN fails every query identically, so it has
// to be told apart from "this one brand's search errored". Surfaced 2026-08-09:
// the token had expired, every list threw invalid_grant, and swallowing that as
// an empty result reported a confident "No new trips found" over a scan that
// never reached Gmail — the dishonest-empty-state failure this app's own rules
// forbid.
function isAuthFailure(err) {
  const message = String(err?.message || '');
  const status = err?.response?.status ?? err?.code;
  return (
    message.includes('invalid_grant') ||
    message.includes('invalid_client') ||
    message.includes('unauthorized_client') ||
    status === 401 ||
    status === 403
  );
}

async function listIds(gmail, q, maxResults) {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults,
    });
    return { ids: (res.data.messages || []).map((m) => m.id), failed: false };
  } catch (err) {
    // One brand's transient failure must not sink the whole scan — but the
    // caller still needs to know it happened, and an auth failure is fatal.
    console.error('[trip-scan] list failed for query:', q, err?.message || err);
    return { ids: [], failed: true, authFailed: isAuthFailure(err) };
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

// Skip a candidate if something already known plainly covers it: dates overlap
// AND the destinations share a real place-word. Coarse on purpose — a false
// "already have it" only means one fewer suggestion, which John can still add
// manually.
//
// `known` is real trips PLUS every prior suggestion (pending, approved, or
// dismissed) and anything created earlier in this same run. Matching against
// suggestions too became load-bearing with the allowlist pass above: one cruise
// booking is echoed by dozens of marketing emails, each a distinct Gmail id, so
// the source_gmail_id key alone would file the same sailing dozens of times —
// and a trip John already dismissed would come straight back every scan.
function matchesKnownTrip(cand, known) {
  const candWords = new Set(
    meaningfulWords(cand.destination).map((w) => w.toLowerCase())
  );
  return known.some((t) => {
    const shareWord = meaningfulWords(t.destination).some((w) =>
      candWords.has(w.toLowerCase())
    );
    if (!shareWord) return false;
    if (!cand.start_date || !t.start_date) return true; // shared place, no dates to separate them
    // Normalize both sides to bare "YYYY-MM-DD" before comparing. The trip rows
    // come from Neon as JS Date objects (DATE columns) while the candidate dates
    // are plain strings from detection; a raw Date <= string comparison coerces
    // the Date via .toString() ("Thu Jul 16 2026 ..."), not its ISO form, so the
    // overlap test was never reliably correct. dateOnly gives both an ISO date
    // string, which sorts lexicographically the same as calendar order.
    const cs = dateOnly(cand.start_date);
    const ce = dateOnly(cand.end_date || cand.start_date);
    const ts = dateOnly(t.start_date);
    const te = dateOnly(t.end_date || t.start_date);
    return cs <= te && ts <= ce; // range overlap
  });
}

async function runScan() {
  const gmail = getGmailClient();
  if (!gmail) return { configured: false, scanned: 0, created: 0 };

  const sql = getDb();
  const [seenRows, trips, suggestions] = await Promise.all([
    sql`SELECT source_gmail_id FROM trip_suggestions WHERE source_gmail_id IS NOT NULL`,
    sql`SELECT destination, start_date, end_date FROM trips`,
    sql`SELECT destination, start_date, end_date FROM trip_suggestions`,
  ]);
  const seen = new Set(seenRows.map((r) => r.source_gmail_id));
  const known = [...trips, ...suggestions];

  // Two passes: the high-precision non-promotional query, plus one small
  // per-brand query over the travel allowlist (whose booking mail Gmail files
  // under Promotions). Brand queries run concurrently and are capped
  // individually, so no single sender can crowd out the rest.
  const [primary, travelResults] = await Promise.all([
    listIds(gmail, lookbackQuery(), MAX_CANDIDATES),
    mapWithConcurrency(TRAVEL_SENDER_DOMAINS, 6, (domain) =>
      listIds(gmail, travelSenderQuery(domain), MAX_PER_TRAVEL_SENDER)
    ),
  ]);

  // Report a search that never ran as an error, never as "nothing found".
  const all = [primary, ...travelResults];
  if (all.some((r) => r.authFailed)) {
    return { configured: true, error: 'gmail_auth', scanned: 0, created: 0 };
  }
  if (primary.failed) {
    return {
      configured: true,
      error: 'gmail_unavailable',
      scanned: 0,
      created: 0,
    };
  }

  const primaryIds = primary.ids;
  const travelIds = [...new Set(travelResults.flatMap((r) => r.ids))].slice(
    0,
    MAX_TRAVEL_CANDIDATES
  );
  // Reserve the allowlist slots before filling the rest from the primary pass,
  // so a full primary result set can never squeeze the travel pass back out.
  const primaryBudget = Math.max(0, MAX_CANDIDATES - travelIds.length);
  const ids = [
    ...new Set([...primaryIds.slice(0, primaryBudget), ...travelIds]),
  ].filter((id) => !seen.has(id));

  let created = 0;
  // Detection is the slow part (one Haiku round trip each), so candidates are
  // read and classified in small concurrent batches; the accept/insert decision
  // stays strictly sequential, since each new suggestion has to be visible to
  // the dedupe check for every candidate that follows it in the same run.
  const detected = await mapWithConcurrency(
    ids,
    DETECT_CONCURRENCY,
    async (id) => {
      try {
        const res = await gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'full',
        });
        const subject = header(res.data.payload?.headers, 'Subject');
        const body = extractPlainText(res.data.payload, BODY_LIMIT);
        const trip = await detectTripFromEmail({ subject, body });
        return { id, subject, trip };
      } catch (err) {
        console.error('[trip-scan] candidate failed:', id, err?.message || err);
        return { id, subject: null, trip: null };
      }
    }
  );

  for (const { id, subject, trip } of detected) {
    if (!trip || trip.confidence < MIN_CONFIDENCE || !trip.start_date) continue;
    if (matchesKnownTrip(trip, known)) continue;

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
    if (inserted.length) {
      created++;
      known.push(trip); // later candidates in this run must see it
    }
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
  } catch (err) {
    // Surfaced 2026-08-09: a silent catch here made a failing scan
    // undiagnosable from the Vercel logs — always log the real cause.
    console.error('[trip-scan] scan failed:', err);
    return Response.json({ error: 'scan failed' }, { status: 502 });
  }
}

export async function POST() {
  try {
    return Response.json(await runScan());
  } catch (err) {
    console.error('[trip-scan] scan failed:', err);
    return Response.json({ error: 'scan failed' }, { status: 502 });
  }
}
