import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { normalizeChecklistItems } from '../../../../lib/checklists';

// Update a trip's checklist — toggling item `done` state, editing items, or
// renaming. Items are stored as [{text, section, done}].

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM trip_checklists WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const title = (body.title ?? existing.title).trim();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  const items =
    body.items !== undefined
      ? JSON.stringify(normalizeChecklistItems(body.items))
      : existing.items;

  const [row] = await sql`
    UPDATE trip_checklists
    SET title = ${title}, items = ${items}
    WHERE id = ${id}
    RETURNING id, trip_id, template_id, title, items, created_at, updated_at
  `;
  return Response.json({ checklist: row });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM trip_checklists WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
