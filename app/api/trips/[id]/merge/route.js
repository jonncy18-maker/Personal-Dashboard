import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { serializeTrip } from '../../../../../lib/trips';

// Folds one or more existing trip rows ("legs") into this trip ("root") — the
// fix for the same real journey landing as several separate rows (a flight
// confirmation, a cruise confirmation, a hotel confirmation, each scanned or
// entered independently). A leg keeps its own row untouched (itinerary,
// notes, budget); only merged_into_id is set, so lib/trip-merge.js's
// collapseMergedTrips() can fold it into the root's date range everywhere
// trips are counted (PTO, Travel Stats, Home) without a leg ever double-
// counting on its own. Merging is one level deep (see lib/trip-merge.js's
// header comment) — a leg can't itself be a root, and a trip that already has
// legs can't be merged into something else without unmerging its own legs
// first.
export const POST = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const legIds = Array.isArray(body.leg_ids)
    ? [...new Set(body.leg_ids.filter(Boolean))]
    : [];
  if (legIds.length === 0) {
    return Response.json({ error: 'leg_ids is required' }, { status: 400 });
  }
  if (legIds.includes(id)) {
    return Response.json(
      { error: 'a trip cannot be merged into itself' },
      { status: 400 }
    );
  }

  const sql = getDb();

  const [root] = await sql`
    SELECT id, merged_into_id FROM trips WHERE id = ${id}
  `;
  if (!root) return Response.json({ error: 'trip not found' }, { status: 404 });
  if (root.merged_into_id) {
    return Response.json(
      {
        error:
          'this trip is itself a merged leg — unmerge it before merging others into it',
      },
      { status: 400 }
    );
  }

  for (const legId of legIds) {
    const [leg] = await sql`
      SELECT id, merged_into_id FROM trips WHERE id = ${legId}
    `;
    if (!leg) {
      return Response.json(
        { error: `trip ${legId} not found` },
        { status: 404 }
      );
    }
    const [childOfLeg] = await sql`
      SELECT id FROM trips WHERE merged_into_id = ${legId} LIMIT 1
    `;
    if (childOfLeg) {
      return Response.json(
        {
          error: `trip ${legId} already has its own merged legs — unmerge those first`,
        },
        { status: 400 }
      );
    }
  }

  for (const legId of legIds) {
    await sql`UPDATE trips SET merged_into_id = ${id} WHERE id = ${legId}`;
  }

  const legs = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           image_url, image_source
    FROM trips WHERE merged_into_id = ${id}
    ORDER BY start_date IS NULL, start_date ASC
  `;
  return Response.json({ legs: legs.map(serializeTrip) });
});
