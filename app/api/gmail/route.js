import { getDb } from '../../../lib/db';
import { getGmailClient } from '../../../lib/google';
import { shouldHideByRule } from '../../../lib/email-tier2';

// Read-only Gmail proxy — list only, no write/modify/delete calls, ever
// (CLAUDE.md §2/§7 hard boundary). Tier 1 filtering is a plain DB lookup
// against active sender rules; Tier 2 additionally asks Haiku to evaluate a
// message against that sender's plain-language rule (lib/email-tier2.js) —
// deliberately not run against Tier 1 senders, which are already filtered
// out before Tier 2 ever sees them. Gmail's mailbox itself is never touched.

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
  const rules = await sql`
    SELECT tier, sender, rule_text FROM email_rules WHERE active = true
  `;
  const tier1Domains = new Set(
    rules.filter((r) => r.tier === 1).map((r) => r.sender.toLowerCase())
  );
  const tier2Rules = new Map(
    rules
      .filter((r) => r.tier === 2)
      .map((r) => [r.sender.toLowerCase(), r.rule_text])
  );

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
    const candidates = [];
    for (const res of details) {
      const headers = res.data.payload?.headers;
      const from = header(headers, 'From');
      const domain = extractSenderDomain(from);

      if (domain && tier1Domains.has(domain)) {
        hiddenCount++;
        continue;
      }

      candidates.push({
        id: res.data.id,
        subject: header(headers, 'Subject') || '(no subject)',
        from: extractSenderName(from),
        domain,
        date: header(headers, 'Date'),
        snippet: res.data.snippet || '',
      });
    }

    const evaluated = await Promise.all(
      candidates.map(async (message) => {
        const ruleText = message.domain && tier2Rules.get(message.domain);
        if (!ruleText) return message;
        const hide = await shouldHideByRule(
          ruleText,
          message.from,
          message.subject,
          message.snippet
        );
        return hide ? null : message;
      })
    );

    const messages = evaluated.filter(Boolean);
    hiddenCount += evaluated.length - messages.length;

    return Response.json({ messages, hiddenCount, configured: true });
  } catch {
    return Response.json(
      { messages: [], configured: true, error: 'lookup failed' },
      { status: 502 }
    );
  }
}
