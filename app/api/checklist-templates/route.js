import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';
import { normalizeTemplateItems } from '../../../lib/checklists';

// Travel prep checklist templates (migration 010) — the reusable master lists
// John maintains (Philippines/Cruise, Business Travel, Vacation Travel). Items
// are an ordered [{text, section}]; a trip applies a template via
// /api/trip-checklists, which copies the items so a later template edit never
// disturbs a past trip's checked state.

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, items, position, created_at, updated_at
    FROM checklist_templates
    ORDER BY position ASC, created_at ASC
  `;
  return Response.json({ templates: rows });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const items = JSON.stringify(normalizeTemplateItems(body.items));

  const sql = getDb();
  // New templates sort after the current last one.
  const [{ next }] = await sql`
    SELECT COALESCE(MAX(position), -1) + 1 AS next FROM checklist_templates
  `;
  const [row] = await sql`
    INSERT INTO checklist_templates (name, items, position)
    VALUES (${name}, ${items}, ${next})
    RETURNING id, name, items, position, created_at, updated_at
  `;
  return Response.json({ template: row }, { status: 201 });
});
