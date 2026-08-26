import { getDb, num } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { geocodeQueryResult } from '../../../../lib/geocode';

// Favorite places (Home, Gym, Work, ...) — geocoded and cached once at save
// time, same one-lookup-per-change discipline as everywhere else in this
// app. A failed geocode still saves the place (lat/lng null); a trip/leg
// referencing it just falls back to geocoding the label itself, same as
// before this table existed.

export const POST = route(async (request) => {
  const body = await request.json();
  const label = (body.label || '').trim();
  const address = (body.address || '').trim();
  if (!label || !address) {
    return Response.json(
      { error: 'label and address are required' },
      { status: 400 }
    );
  }

  const geocoded = await geocodeQueryResult(address);
  const coords = geocoded.status === 'ok' ? geocoded.coords : null;

  const sql = getDb();
  try {
    const [row] = await sql`
      INSERT INTO mileage_places (label, address, lat, lng)
      VALUES (${label}, ${address}, ${coords?.latitude ?? null}, ${coords?.longitude ?? null})
      RETURNING *
    `;
    return Response.json(
      { place: { ...row, lat: num(row.lat), lng: num(row.lng) } },
      { status: 201 }
    );
  } catch (err) {
    if (String(err?.message || '').includes('mileage_places_label_key')) {
      return Response.json(
        { error: 'a place with that label already exists' },
        { status: 400 }
      );
    }
    throw err;
  }
});
