import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { header } from '../../../lib/email-sender';
import { extractPlainText } from '../../../lib/gmail-body';
import { detectTripFromEmail } from '../../../lib/trip-detect';
import {
  primaryQuery,
  travelSenderQuery,
  dateStamp,
  isAuthFailure,
  mapWithConcurrency,
  matchesKnownTrip,
  TRAVEL_SENDER_DOMAINS,
  MIN_CONFIDENCE,
  BODY_LIMIT,
  DETECT_CONCURRENCY,
} from '../../../lib/trip-scan-shared';

// One-time historical Travel backfill, distinct from the weekly trip-scan
// (30-day lookback, for ongoing new-booking detection). John asked to pull
// years of PAST trips out of Gmail into the same Approve/Dismiss review queue
// (trip_suggestions) the weekly scan already uses — never auto-created, same
// hard boundary. Same search vocabulary as the weekly scan (lib/trip-scan-
// shared), just a much older `after:` date.
//
// Gmail lists newest-first and a single request has a hard duration cap, so a
// 10+ year search can't finish in one round trip. trip_history_scan (027)
// tracks a cursor — which query in the frozen list, and Gmail's own
// pageToken within it — so POSTing again (the "Continue import" button)
// picks up exactly where the last request left off instead of rescanning.
export const maxDuration = 60;

const SINCE_YEAR = 2015;
const PAGE_SIZE = 25; // messages per Gmail list call, per query, per page
const TIME_BUDGET_MS = 50000; // leaves headroom under maxDuration for in-flight work

function buildQueries() {
  const afterStamp = dateStamp(new Date(SINCE_YEAR, 0, 1));
  return [
    primaryQuery(afterStamp),
    ...TRAVEL_SENDER_DOMAINS.map((domain) =>
      travelSenderQuery(domain, afterStamp)
    ),
  ];
}

function freshRow() {
  return {
    since_year: SINCE_YEAR,
    queries: buildQueries(),
    query_index: 0,
    page_token: null,
    scanned_count: 0,
    created_count: 0,
    done: false,
  };
}

async function loadState(sql) {
  const rows = await sql`SELECT * FROM trip_history_scan WHERE id = 1`;
  return rows[0] || null;
}

async function startState(sql) {
  const f = freshRow();
  const [row] = await sql`
    INSERT INTO trip_history_scan
      (id, since_year, queries, query_index, page_token, scanned_count, created_count, done, started_at, updated_at)
    VALUES
      (1, ${f.since_year}, ${JSON.stringify(f.queries)}::jsonb, 0, NULL, 0, 0, false, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      since_year = EXCLUDED.since_year,
      queries = EXCLUDED.queries,
      query_index = 0,
      page_token = NULL,
      scanned_count = 0,
      created_count = 0,
      done = false,
      started_at = now(),
      updated_at = now()
    RETURNING *
  `;
  return row;
}

async function listPage(gmail, q, pageToken) {
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: PAGE_SIZE,
      pageToken: pageToken || undefined,
    });
    return {
      ids: (res.data.messages || []).map((m) => m.id),
      nextPageToken: res.data.nextPageToken || null,
      failed: false,
    };
  } catch (err) {
    console.error(
      '[trip-history-scan] list failed for query:',
      q,
      err?.message || err
    );
    return {
      ids: [],
      nextPageToken: null,
      failed: true,
      authFailed: isAuthFailure(err),
    };
  }
}

async function runChunk(state) {
  const gmail = getGmailClient();
  if (!gmail) return { configured: false, done: false, scanned: 0, created: 0 };

  const sql = getDb();
  const [seenRows, trips, suggestions] = await Promise.all([
    sql`SELECT source_gmail_id FROM trip_suggestions WHERE source_gmail_id IS NOT NULL`,
    sql`SELECT destination, start_date, end_date FROM trips`,
    sql`SELECT destination, start_date, end_date FROM trip_suggestions`,
  ]);
  const seen = new Set(seenRows.map((r) => r.source_gmail_id));
  const known = [...trips, ...suggestions];
  const scannedThisRun = new Set(); // a message can match more than one query in the same run

  const queries = state.queries;
  let queryIndex = state.query_index;
  let pageToken = state.page_token;
  let runScanned = 0;
  let runCreated = 0;
  const deadline = Date.now() + TIME_BUDGET_MS;

  while (queryIndex < queries.length && Date.now() < deadline) {
    const page = await listPage(gmail, queries[queryIndex], pageToken);

    if (page.authFailed) {
      return { configured: true, error: 'gmail_auth', done: false };
    }
    if (page.failed) {
      // A bad/transient query must not stall the whole backfill forever —
      // move on rather than retrying the same query indefinitely.
      queryIndex++;
      pageToken = null;
      continue;
    }

    const newIds = page.ids.filter(
      (id) => !seen.has(id) && !scannedThisRun.has(id)
    );
    newIds.forEach((id) => scannedThisRun.add(id));

    const detected = await mapWithConcurrency(
      newIds,
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
          console.error(
            '[trip-history-scan] candidate failed:',
            id,
            err?.message || err
          );
          return { id, subject: null, trip: null };
        }
      }
    );
    runScanned += newIds.length;

    for (const { id, subject, trip } of detected) {
      if (!trip || trip.confidence < MIN_CONFIDENCE || !trip.start_date)
        continue;
      if (matchesKnownTrip(trip, known)) continue;

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
        runCreated++;
        known.push(trip);
      }
    }

    if (page.nextPageToken) {
      pageToken = page.nextPageToken;
    } else {
      queryIndex++;
      pageToken = null;
    }
  }

  const done = queryIndex >= queries.length;
  const totalScanned = state.scanned_count + runScanned;
  const totalCreated = state.created_count + runCreated;

  await sql`
    UPDATE trip_history_scan SET
      query_index = ${queryIndex},
      page_token = ${pageToken},
      scanned_count = ${totalScanned},
      created_count = ${totalCreated},
      done = ${done}
    WHERE id = 1
  `;

  return {
    configured: true,
    done,
    scannedThisRun: runScanned,
    createdThisRun: runCreated,
    totalScanned,
    totalCreated,
    queriesTotal: queries.length,
    queriesDone: queryIndex,
  };
}

// GET reports current progress without touching Gmail — the UI polls this to
// render "N scanned so far" / a "Continue import" vs "Import Trip History"
// button without starting a scan on page load.
export async function GET() {
  const sql = getDb();
  const state = await loadState(sql);
  if (!state) {
    return Response.json({
      started: false,
      done: false,
      scanned: 0,
      created: 0,
    });
  }
  return Response.json({
    started: true,
    done: state.done,
    scanned: state.scanned_count,
    created: state.created_count,
    sinceYear: state.since_year,
    queriesTotal: state.queries.length,
    queriesDone: state.query_index,
  });
}

// POST runs one time-boxed chunk. Pass {"restart": true} to discard any
// prior progress and start over from SINCE_YEAR (e.g. after changing the
// constant) — otherwise a completed scan is reported as already done rather
// than rescanned, and an in-progress one is resumed from its saved cursor.
export async function POST(request) {
  let restart = false;
  try {
    const body = await request.json();
    restart = body?.restart === true;
  } catch {
    // no body — normal case
  }

  const sql = getDb();
  try {
    let state = restart ? null : await loadState(sql);
    if (!state) state = await startState(sql);

    if (state.done) {
      return Response.json({
        configured: true,
        done: true,
        alreadyDone: true,
        totalScanned: state.scanned_count,
        totalCreated: state.created_count,
      });
    }

    return Response.json(await runChunk(state));
  } catch (err) {
    console.error('[trip-history-scan] scan failed:', err);
    return Response.json({ error: 'scan failed' }, { status: 502 });
  }
}
