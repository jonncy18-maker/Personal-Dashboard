import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

// Un-ticking a service. Deleting the latest record restores the item's
// previous due point on its own, since "last done" is simply the newest row —
// a mis-tick is recoverable rather than something John has to work around by
// editing intervals.
//
// A mileage_readings row created by that check-off's opt-in is deliberately
// NOT removed here: it records a real odometer observation, which stays true
// regardless of whether the service it accompanied was logged by mistake.
// Corrections to the odometer log belong on the Mileage tab.

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const rows = await sql`
    DELETE FROM maintenance_records WHERE id = ${id} RETURNING id
  `;
  if (rows.length === 0) {
    return Response.json({ error: 'record not found' }, { status: 404 });
  }
  return Response.json({ ok: true });
});
