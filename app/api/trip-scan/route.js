import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { header } from '../../../lib/email-sender';
import { extractPlainText } from '../../../lib/gmail-body';
import { detectTripFromEmail } from '../../../lib/trip-detect';
import {
  primaryQuery,
  travelSenderQuery as sharedTravelSenderQuery,
  dateStamp,
  isAuthFailure,
  mapWithConcurrency,
  matchesKnownTrip,
  TRAVEL_SENDER_DOMAINS,
  MIN_CONFIDENCE,
  BODY_LIMIT,
  DETECT_CONCURRENCY,
} from '../../../lib/trip-scan-shared';

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

const LOOKBACK_DAYS = 30;
const MAX_CANDIDATES = 40; // headroom so real confirmations aren't truncated
// Per-brand cap on the allowlist pass. A cruise line re-sends the same
// reservation block in every sale email (Celebrity: 37 threads in 30 days), so
// the newest few are plenty — and without a cap one chatty brand would eat the
// whole candidate budget and truncate everything else, the exact failure the
// SEARCH_TERMS comment (lib/trip-scan-shared) above describes.
const MAX_PER_TRAVEL_SENDER = 3;
const MAX_TRAVEL_CANDIDATES = 15; // slots reserved for the allowlist pass

function sinceStamp() {
  return dateStamp(new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000));
}

function lookbackQuery() {
  return primaryQuery(sinceStamp());
}

// Same keywords, one trusted sender, no category exclusion.
function travelSenderQuery(domain) {
  return sharedTravelSenderQuery(domain, sinceStamp());
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
