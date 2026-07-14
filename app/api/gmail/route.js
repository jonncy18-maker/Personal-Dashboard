import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';

// Read-only Gmail proxy — list only, no write/modify/delete calls, ever
// (CLAUDE.md §2/§7 hard boundary). Tier 1 filtering is a plain DB lookup
// against active sender rules; Gmail's mailbox itself is never touched.

function extractSenderDomain(fromHeader) {
  const match = /<([^>]+)>/.exec(fromHeader || '') || [
    null,
    (fromHeader || '').trim(),
  ];
  const email = (match[1] || '').toLowerCase();
  const at = email.lastIndexOf('@');
  return at === -1 ? null : email.slice(at + 1);
}

function extractSenderName(fromHeader) {
  const match = /^([^<]+)</.exec(fromHeader || '');
  return match ? match[1].trim().replace(/^"|"$/g, '') : fromHeader || '';
}

function header(headers, name) {
  return headers?.find((h) => h.name === name)?.value || '';
}

export async function GET() {
  const gmail = getGmailClient();
  if (!gmail) {
    return Response.json({ messages: [], configured: false });
  }

  const sql = getDb();
  const hiddenRules = await sql`
    SELECT sender FROM email_rules WHERE tier = 1 AND active = true
  `;
  const hiddenDomains = new Set(hiddenRules.map((r) => r.sender.toLowerCase()));

  try {
    const list = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 40,
    });

    const ids = list.data.messages || [];
    const details = await Promise.all(
      ids.map((m) =>
        gmail.users.messages.get({
          userId: 'me',
          id: m.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        })
      )
    );

    let hiddenCount = 0;
    const messages = [];
    for (const res of details) {
      const headers = res.data.payload?.headers;
      const from = header(headers, 'From');
      const domain = extractSenderDomain(from);

      if (domain && hiddenDomains.has(domain)) {
        hiddenCount++;
        continue;
      }

      messages.push({
        id: res.data.id,
        subject: header(headers, 'Subject') || '(no subject)',
        from: extractSenderName(from),
        domain,
        date: header(headers, 'Date'),
        snippet: res.data.snippet || '',
      });
    }

    return Response.json({ messages, hiddenCount, configured: true });
  } catch {
    return Response.json(
      { messages: [], configured: true, error: 'lookup failed' },
      { status: 502 }
    );
  }
}
