import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// DELETE /api/calendar-hidden/:id — unhide (remove the flag entirely).
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM calendar_hidden WHERE gcal_event_id = ${id}`;
  return Response.json({ ok: true });
});
