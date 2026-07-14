import { getDb } from '../../../lib/db';

// Tier 1 (sender rules) CRUD — see CLAUDE.md §7. Triggered by the "X" button
// on an email; no AI, the sender domain is parsed directly from the header
// on the client and posted here as a deterministic hide rule.

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, tier, sender, rule_text, active, created_at
    FROM email_rules
    WHERE tier = 1 AND active = true
    ORDER BY created_at DESC
  `;
  return Response.json({ rules: rows });
}

export async function POST(request) {
  const body = await request.json();
  const sender = (body.sender || '').trim().toLowerCase();
  if (!sender) {
    return Response.json({ error: 'sender is required' }, { status: 400 });
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO email_rules (tier, sender, active)
    VALUES (1, ${sender}, true)
    RETURNING id, tier, sender, rule_text, active, created_at
  `;
  return Response.json({ rule: row }, { status: 201 });
}
