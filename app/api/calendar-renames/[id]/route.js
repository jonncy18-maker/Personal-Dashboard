import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// DELETE /api/calendar-renames/:id — revert to the real Calendar title
// (removes the override; the actual event is never touched, so this is a
// pure local revert).
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM calendar_renames WHERE scope_id = ${id}`;
  return Response.json({ ok: true });
});
