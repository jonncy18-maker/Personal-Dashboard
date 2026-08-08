import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// Saved PTO simulation scenarios. Items are references + ranges only — costs
// are always computed live (lib/pto.js), never persisted (PTO_BUILD_PLAN.md §4).

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

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.every(validItem)) {
    return Response.json({ error: 'invalid scenario item' }, { status: 400 });
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO pto_scenarios (name, items)
    VALUES (${name}, ${JSON.stringify(items)})
    RETURNING id, name, items, created_at, updated_at
  `;
  return Response.json({ scenario: row }, { status: 201 });
});
