import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM pto_entries WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
