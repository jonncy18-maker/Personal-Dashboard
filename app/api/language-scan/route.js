import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { header } from '../../../lib/email-sender';
import { extractPlainText } from '../../../lib/gmail-body';
import { parseItalkiAcceptance } from '../../../lib/language-detect';

// Weekly italki booking auto-detection (CLAUDE.md §7 + ROADMAP 2026-07-15).
// Read-only Gmail, same hard boundary as Email/Travel. Deterministic search +
// deterministic parse — no AI (see lib/language-detect.js for why). Each new
// booking is stored as a PENDING language_call for John to Approve or
// Dismiss; nothing is auto-added. Runs on a weekly Vercel Cron (GET) and the
// manual "Scan Gmail" button on /language (POST) — both call runScan().

const LOOKBACK_DAYS = 60; // italki bookings have been seen weeks in advance
const MAX_CANDIDATES = 30;

function lookbackQuery() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const y = since.getFullYear();
  const m = String(since.getMonth() + 1).padStart(2, '0');
  const d = String(since.getDate()).padStart(2, '0');
  return `from:noreply@italki.com subject:"has been accepted" after:${y}/${m}/${d}`;
}

async function runScan() {
  const gmail = getGmailClient();
  if (!gmail) return { configured: false, scanned: 0, created: 0 };

  const sql = getDb();
  const seenRows = await sql`
    SELECT source_gmail_id FROM language_calls WHERE source_gmail_id IS NOT NULL
  `;
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

    const parsed = parseItalkiAcceptance(body);
    if (!parsed || new Date(parsed.start_at) <= new Date()) continue;

    // ON CONFLICT guards the unique source_gmail_id in case of a concurrent run.
    const inserted = await sql`
      INSERT INTO language_calls (tutor, start_at, source_gmail_id, source_subject)
      VALUES (${parsed.tutor}, ${parsed.start_at}, ${id}, ${subject || null})
      ON CONFLICT (source_gmail_id) DO NOTHING
      RETURNING id
    `;
    if (inserted.length) created++;
  }

  return { configured: true, scanned: ids.length, created };
}

// GET is the Vercel Cron entry point, gated by CRON_SECRET the same way
// app/api/trip-scan is. POST is the same-origin "Scan Gmail" button.
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
