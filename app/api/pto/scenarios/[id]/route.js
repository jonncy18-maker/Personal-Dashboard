import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

function validItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.kind === 'wishlist_trip') return typeof item.trip_id === 'string';
  if (item.kind === 'range') {
    return (
      typeof item.start_date === 'string' && typeof item.end_date === 'string'
    );
  }
  return false;
}

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM pto_scenarios WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const name =
    body.name !== undefined ? (body.name || '').trim() : existing.name;
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  let items = existing.items;
  if (body.items !== undefined) {
    if (!Array.isArray(body.items) || !body.items.every(validItem)) {
      return Response.json({ error: 'invalid scenario item' }, { status: 400 });
    }
    items = body.items;
  }

  const [row] = await sql`
    UPDATE pto_scenarios
    SET name = ${name}, items = ${JSON.stringify(items)}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, name, items, created_at, updated_at
  `;
  return Response.json({ scenario: row });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM pto_scenarios WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
