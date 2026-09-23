import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

// Removing one logged drink (logged twice, wrong amount). There is no PATCH:
// a drink is one number, so a correction is delete + log again.
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_water_entries WHERE id = ${id} RETURNING id
  `;
  if (!row) {
    return Response.json({ error: 'water entry not found' }, { status: 404 });
  }
  return Response.json({ deleted: row.id });
});
