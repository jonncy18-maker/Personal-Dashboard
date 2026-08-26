import { getDb, num } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import {
  fetchDrivingDistanceMiles,
  loadPlacesByLabel,
} from '../../../../lib/route-distance';

// Named routes behind the "usual trips" detail popup (Home → Gym, Home →
// Work, ...). Same fail-soft lookup as the trip journal: geocode + OSRM by
// default, or John supplies miles by hand when the lookup can't resolve it.

export const POST = route(async (request) => {
  const body = await request.json();
  const origin = (body.origin || '').trim();
  const destination = (body.destination || '').trim();
  if (!origin || !destination) {
    return Response.json(
      { error: 'origin and destination are required' },
      { status: 400 }
    );
  }

  const timesPerWeek = Number(body.times_per_week);
  if (!Number.isFinite(timesPerWeek) || timesPerWeek <= 0) {
    return Response.json(
      { error: 'times_per_week must be a positive number' },
      { status: 400 }
    );
  }

  const sql = getDb();

  let miles = body.miles != null ? Number(body.miles) : null;
  if (miles == null) {
    const placesByLabel = await loadPlacesByLabel(sql);
    const result = await fetchDrivingDistanceMiles(
      origin,
      destination,
      placesByLabel
    );
    if (result.status === 'ok') {
      miles = result.miles;
    }
  }
  if (miles == null || !Number.isFinite(miles) || miles < 0) {
    return Response.json(
      { error: 'could not look up a driving distance — enter miles manually' },
      { status: 400 }
    );
  }

  const notes = body.notes || null;

  const [row] = await sql`
    INSERT INTO mileage_usual_legs (origin, destination, miles, times_per_week, notes)
    VALUES (${origin}, ${destination}, ${miles}, ${timesPerWeek}, ${notes})
    RETURNING *
  `;
  return Response.json(
    {
      leg: {
        ...row,
        miles: num(row.miles),
        times_per_week: num(row.times_per_week),
      },
    },
    { status: 201 }
  );
});
