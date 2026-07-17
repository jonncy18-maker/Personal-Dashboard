import { getDb, num, dateOnly } from '../../../lib/db';
import { geocodeDestination } from '../../../lib/geocode';
import { geocodeStops, mappableStops } from '../../../lib/itinerary';

// GET the trip pins for the Trip Map. A trip is placed either by its own
// destination coords (single dot) or, when its itinerary has located stops, by
// one dot per stop connected into that trip's route (a cruise's ports, a
// multi-leg journey). Coords are normally resolved on create/edit (see
// app/api/trips), but anything still missing them — a trip or stop created
// before this feature, or a stop left pending by the per-save geocode cap — is
// resolved lazily here and persisted, so the backfill happens at most once per
// trip/stop, never on every load. Anything that can't be geocoded is simply
// omitted from the map, never a broken view.

function serialize(row) {
  const stops = mappableStops(row.itinerary);
  return {
    id: row.id,
    destination: row.destination,
    status: row.status,
    start_date: dateOnly(row.start_date),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    stops,
  };
}

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, destination, status, start_date, latitude, longitude,
           geocoded_at, itinerary
    FROM trips
    ORDER BY start_date IS NULL, start_date ASC, created_at DESC
  `;

  const result = [];
  for (const row of rows) {
    let current = row;

    // Trip-level backfill: a trip that never resolved its own destination.
    if (current.latitude == null && current.geocoded_at == null) {
      const coords = await geocodeDestination(current.destination);
      // Stamp geocoded_at either way so a permanent non-match isn't retried on
      // every load (a real place resolves once; an unresolvable name stops
      // nagging).
      const [updated] = await sql`
        UPDATE trips
        SET latitude = ${coords?.latitude ?? null},
            longitude = ${coords?.longitude ?? null},
            geocoded_at = now()
        WHERE id = ${current.id}
        RETURNING id, destination, status, start_date, latitude, longitude,
                  geocoded_at, itinerary
      `;
      current = updated;
    }

    // Stop-level backfill: resolve any itinerary stop the save cap left pending
    // (or a stop from before this feature). Persist only when something changed.
    const { stops, changed } = await geocodeStops(current.itinerary);
    if (changed) {
      const [updated] = await sql`
        UPDATE trips SET itinerary = ${JSON.stringify(stops)}
        WHERE id = ${current.id}
        RETURNING id, destination, status, start_date, latitude, longitude,
                  geocoded_at, itinerary
      `;
      current = updated;
    }

    result.push(serialize(current));
  }

  return Response.json({ pins: result });
}
