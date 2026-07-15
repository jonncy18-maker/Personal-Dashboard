import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import {
  extractSenderDomain,
  extractSenderName,
  header,
} from '../../../lib/email-sender';

// First-run onboarding scan — CLAUDE.md §7. On the very first visit to /email,
// group recent senders by frequency (a plain frequency count, NO model) and
// propose the noisiest domains as one-pass Tier 1 hide-rule candidates. This is
// deliberately ONE-TIME: completion is recorded in app_flags and the GET below
// short-circuits on every subsequent load so the scan never re-runs. Grouping
// happens in memory over the read-only Gmail listing (no message is ever stored
// server-side, and the mailbox itself is never modified).

const FLAG_KEY = 'email_onboarding_done';
const SAMPLE_SIZE = 100; // recent inbox messages to scan, one time only
const MIN_COUNT = 3; // only propose senders noisy enough to matter
const MAX_CANDIDATES = 12;

async function isDone(sql) {
  const [row] = await sql`
    SELECT value FROM app_flags WHERE key = ${FLAG_KEY}
  `;
  return Boolean(row?.value?.done);
}

async function markDone(sql) {
  await sql`
    INSERT INTO app_flags (key, value)
    VALUES (${FLAG_KEY}, ${JSON.stringify({ done: true })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}

export async function GET() {
  const sql = getDb();

  if (await isDone(sql)) {
    return Response.json({ done: true, candidates: [] });
  }

  const gmail = getGmailClient();
  if (!gmail) {
    // Not configured yet — nothing to scan, but don't burn the one-time flag.
    return Response.json({ done: false, configured: false, candidates: [] });
  }

  const existing = await sql`
    SELECT sender FROM email_rules WHERE tier = 1 AND active = true
  `;
  const alreadyHidden = new Set(existing.map((r) => r.sender.toLowerCase()));

  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: SAMPLE_SIZE,
    });

    const ids = list.data.messages || [];
    const details = await Promise.all(
      ids.map((m) =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From'],
        })
      )
    );

    // Frequency count by sender domain (the "GROUP BY"), keeping the most
    // recent display name we saw for each so the candidate reads nicely.
    const byDomain = new Map();
    for (const res of details) {
      const from = header(res.data.payload?.headers, 'From');
      const domain = extractSenderDomain(from);
      if (!domain || alreadyHidden.has(domain)) continue;
      const entry = byDomain.get(domain);
      if (entry) {
        entry.count += 1;
      } else {
        byDomain.set(domain, {
          domain,
          name: extractSenderName(from),
          count: 1,
        });
      }
    }

    const candidates = [...byDomain.values()]
      .filter((c) => c.count >= MIN_COUNT)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_CANDIDATES);

    return Response.json({ done: false, configured: true, candidates });
  } catch {
    return Response.json(
      { done: false, configured: true, candidates: [], error: 'scan failed' },
      { status: 502 }
    );
  }
}

// Finish the one-pass scan: create a Tier 1 rule for each approved domain and
// record completion so the scan never runs again — regardless of whether John
// approved everything, some, or nothing (Skip posts an empty list).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const approved = Array.isArray(body.approved) ? body.approved : [];
  const domains = [
    ...new Set(
      approved.map((d) => (d || '').trim().toLowerCase()).filter(Boolean)
    ),
  ];

  const sql = getDb();

  for (const domain of domains) {
    await sql`
      INSERT INTO email_rules (tier, sender, active)
      SELECT 1, ${domain}, true
      WHERE NOT EXISTS (
        SELECT 1 FROM email_rules
        WHERE tier = 1 AND sender = ${domain} AND active = true
      )
    `;
  }

  await markDone(sql);

  return Response.json({ done: true, created: domains.length });
}
