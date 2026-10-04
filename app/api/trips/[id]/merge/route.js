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

  // The checks above give friendly errors, but they are separate statements,
  // so two concurrent merges (say B into A and A into B) can both pass them
  // and leave A and B pointing at each other. The write itself therefore
  // re-checks everything in ONE statement (the HTTP driver has no
  // interactive transactions): it row-locks the root and every leg in id
  // order, keeping only a root that is still unmerged and legs that still
  // have no children of their own. A concurrent writer that already changed
  // one of those rows makes Postgres re-test it after the lock wait, so it
  // drops out of `locked`, the count no longer matches, and the UPDATE
  // changes nothing. All legs move together or none do.
  const moved = await sql`
    WITH locked AS (
      SELECT id FROM trips
      WHERE (id = ${id}::uuid AND merged_into_id IS NULL)
         OR (
           id = ANY(${legIds}::uuid[])
           AND NOT EXISTS (
             SELECT 1 FROM trips c WHERE c.merged_into_id = trips.id
           )
         )
      ORDER BY id
      FOR UPDATE
    ), moved AS (
      UPDATE trips SET merged_into_id = ${id}::uuid
      WHERE id = ANY(${legIds}::uuid[])
        AND (SELECT count(*) FROM locked) = ${legIds.length + 1}
      RETURNING id
    )
    SELECT id FROM moved
  `;
  if (moved.length !== legIds.length) {
    return Response.json(
      { error: 'trips changed while merging — reload and try again' },
      { status: 409 }
    );
  }

  const legs = await sql`
    SELECT id, destination, start_date, end_date, status, notes, budget,
           image_url, image_source
    FROM trips WHERE merged_into_id = ${id}
    ORDER BY start_date IS NULL, start_date ASC
  `;
  return Response.json({ legs: legs.map(serializeTrip) });
});
