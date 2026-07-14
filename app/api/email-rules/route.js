import { getDb } from '../../../lib/db';

// Tier 1 + Tier 2 rule CRUD — see CLAUDE.md §7.
// Tier 1: triggered by the "X" button. No AI — sender domain parsed directly
// from the header on the client, posted here as a deterministic hide rule.
// Tier 2: triggered by "Manage sender". John types a plain-language rule;
// app/api/gmail/route.js evaluates future emails from that sender against it
// via Haiku (lib/email-tier2.js).

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, tier, sender, rule_text, active, created_at
    FROM email_rules
    WHERE active = true
    ORDER BY created_at DESC
  `;
  return Response.json({ rules: rows });
}

export async function POST(request) {
  const body = await request.json();
  const tier = body.tier === 2 ? 2 : 1;
  const sender = (body.sender || '').trim().toLowerCase();
  if (!sender) {
    return Response.json({ error: 'sender is required' }, { status: 400 });
  }

  const sql = getDb();

  if (tier === 1) {
    const [existing] = await sql`
      SELECT id, tier, sender, rule_text, active, created_at
      FROM email_rules
      WHERE tier = 1 AND sender = ${sender} AND active = true
    `;
    if (existing) {
      return Response.json({ rule: existing });
    }
    const [row] = await sql`
      INSERT INTO email_rules (tier, sender, active)
      VALUES (1, ${sender}, true)
      RETURNING id, tier, sender, rule_text, active, created_at
    `;
    return Response.json({ rule: row }, { status: 201 });
  }

  const ruleText = (body.rule_text || '').trim();
  if (!ruleText) {
    return Response.json(
      { error: 'rule_text is required for a Tier 2 rule' },
      { status: 400 }
    );
  }

  // One active Tier 2 rule per sender — managing a sender again replaces it.
  await sql`
    UPDATE email_rules SET active = false
    WHERE tier = 2 AND sender = ${sender} AND active = true
  `;
  const [row] = await sql`
    INSERT INTO email_rules (tier, sender, rule_text, active)
    VALUES (2, ${sender}, ${ruleText}, true)
    RETURNING id, tier, sender, rule_text, active, created_at
  `;
  return Response.json({ rule: row }, { status: 201 });
}
