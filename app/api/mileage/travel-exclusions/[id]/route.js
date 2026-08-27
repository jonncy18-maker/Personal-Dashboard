import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

// Undo an accepted exclusion, or un-dismiss a dismissed one — either way,
// deleting the row makes the trip pending for review again (or, for a
// manual entry, just removes it outright).
export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM mileage_travel_exclusions WHERE id = ${id}`;
  return Response.json({ ok: true });
});
