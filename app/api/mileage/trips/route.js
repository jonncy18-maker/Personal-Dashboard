import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import {
  fetchDrivingDistanceMiles,
  loadPlacesByLabel,
} from '../../../../lib/route-distance';

// Point-to-point trip journal. Looks up real driving distance via OSRM
// (fail-soft — a lookup failure just means `miles` must be supplied by hand,
// never a blocked save). Distance is looked up once here and cached on the
// row, never recomputed on read.

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

  const sql = getDb();

  let miles = body.miles != null ? Number(body.miles) : null;
  let originCoords = null;
  let destinationCoords = null;

  if (miles == null) {
    const placesByLabel = await loadPlacesByLabel(sql);
    const result = await fetchDrivingDistanceMiles(
      origin,
      destination,
      placesByLabel
    );
    if (result.status === 'ok') {
      miles = result.miles;
      originCoords = result.origin;
      destinationCoords = result.destination;
    }
  }

  if (miles == null || !Number.isFinite(miles) || miles < 0) {
    return Response.json(
      { error: 'could not look up a driving distance — enter miles manually' },
      { status: 400 }
    );
  }

  const tripDate =
    body.trip_date && /^\d{4}-\d{2}-\d{2}$/.test(body.trip_date)
      ? body.trip_date
      : null;
  const notes = body.notes || null;

  const [row] = await sql`
    INSERT INTO mileage_trips (
      trip_date, origin, destination,
      origin_lat, origin_lng, destination_lat, destination_lng,
      miles, notes
    ) VALUES (
      ${tripDate}, ${origin}, ${destination},
      ${originCoords?.latitude ?? null}, ${originCoords?.longitude ?? null},
      ${destinationCoords?.latitude ?? null}, ${destinationCoords?.longitude ?? null},
      ${miles}, ${notes}
    )
    RETURNING *
  `;
  return Response.json(
    {
      trip: {
        ...row,
        trip_date: dateOnly(row.trip_date),
        origin_lat: num(row.origin_lat),
        origin_lng: num(row.origin_lng),
        destination_lat: num(row.destination_lat),
        destination_lng: num(row.destination_lng),
        miles: num(row.miles),
      },
    },
    { status: 201 }
  );
});
