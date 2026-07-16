import { getDb, num, dateOnly } from '../../../lib/db';
import { geocodeDestination } from '../../../lib/geocode';

// GET the trip pins for the Trip Map. Trips normally get their coords when
// created/edited (see app/api/trips), but any trip still missing them — e.g.
// created before this feature existed — is geocoded lazily here and persisted,
// so the backfill happens at most once per trip, not on every load. A trip that
// can't be geocoded is simply returned without coords and the map skips it.

function serialize(row) {
  return {
    id: row.id,
    destination: row.destination,
    status: row.status,
    start_date: dateOnly(row.start_date),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
  };
}

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, destination, status, start_date, latitude, longitude, geocoded_at
    FROM trips
    ORDER BY start_date IS NULL, start_date ASC, created_at DESC
  `;

  const result = [];
  for (const row of rows) {
    if (row.latitude == null && row.geocoded_at == null) {
      const coords = await geocodeDestination(row.destination);
      // Stamp geocoded_at either way so a permanent non-match isn't retried on
      // every single load (the Unsplash-retry lesson, inverted): a real place
      // resolves once; a genuinely unresolvable name stops nagging.
      const [updated] = await sql`
        UPDATE trips
        SET latitude = ${coords?.latitude ?? null},
            longitude = ${coords?.longitude ?? null},
            geocoded_at = now()
        WHERE id = ${row.id}
        RETURNING id, destination, status, start_date, latitude, longitude
      `;
      result.push(serialize(updated));
    } else {
      result.push(serialize(row));
    }
  }

  return Response.json({ pins: result });
}
