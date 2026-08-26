import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM mileage_places WHERE id = ${id}`;
  return Response.json({ ok: true });
});
