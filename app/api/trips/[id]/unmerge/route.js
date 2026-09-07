import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { serializeTrip } from '../../../../../lib/trips';

// Detaches this trip from whatever root it was merged into, restoring it to a
// fully standalone trip — its own row was never touched by the merge (see
// app/api/trips/[id]/merge), so unmerging is just clearing the pointer.
export const POST = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    UPDATE trips SET merged_into_id = NULL WHERE id = ${id}
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              latitude, longitude, merged_into_id, created_at, updated_at
  `;
  if (!row) return Response.json({ error: 'trip not found' }, { status: 404 });
  return Response.json({ trip: serializeTrip(row) });
});
