import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { normalizeTemplateItems } from '../../../../lib/checklists';

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] =
    await sql`SELECT * FROM checklist_templates WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const name = (body.name ?? existing.name).trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const items =
    body.items !== undefined
      ? JSON.stringify(normalizeTemplateItems(body.items))
      : existing.items;

  const [row] = await sql`
    UPDATE checklist_templates
    SET name = ${name}, items = ${items}
    WHERE id = ${id}
    RETURNING id, name, items, position, created_at, updated_at
  `;
  return Response.json({ template: row });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM checklist_templates WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
