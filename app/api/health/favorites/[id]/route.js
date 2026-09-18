import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_favorite_meals WHERE id = ${id} RETURNING id
  `;
  if (!row) {
    return Response.json({ error: 'favorite not found' }, { status: 404 });
  }
  return Response.json({ deleted: row.id });
});
