import { getDb } from '../../../lib/db';
import { reverseGeocodeCountry } from '../../../lib/geocode';
import { computeTravelStats } from '../../../lib/travel-stats';

// GET the Travel Stats bar numbers (trips / nights / countries / cruise nights),
// all derived from real trip rows. External-source shape (CLAUDE.md §7): this
// touches Nominatim for the country backfill, so it fails soft — any error
// returns zeroed stats, never a broken page.
//
// Country backfill is lazy and one-shot per trip, the same discipline as the
// trip-map coord backfill: a real trip that has coords but no resolved country
// yet gets reverse-geocoded here and the result cached on the row, stamped so an
// unresolvable trip (mid-ocean coords) isn't retried on every load. Capped per
// pass to stay well under Nominatim's ≤1 req/s policy.

const BACKFILL_CAP = 6;

export async function GET() {
  try {
    const sql = getDb();
    let rows = await sql`
      SELECT id, destination, notes, start_date, end_date, status,
             latitude, longitude, country, country_geocoded_at
      FROM trips
    `;

    // Backfill country for real (non-wishlist) trips that have coords but have
    // never had a country attempt. Sequential + capped: polite to Nominatim and
    // bounded work per request.
    const pending = rows.filter(
      (r) =>
        (r.status === 'upcoming' || r.status === 'past') &&
        r.latitude != null &&
        r.country == null &&
        r.country_geocoded_at == null
    );

    const resolved = new Map();
    for (const trip of pending.slice(0, BACKFILL_CAP)) {
      const { country, countryCode } = await reverseGeocodeCountry(
        trip.latitude,
        trip.longitude
      );
      // Stamp the attempt either way so a definitive/failed lookup isn't retried
      // every load. A transient 'error' still stamps; the next destination edit
      // (which resets country_geocoded_at) is the retry path.
      const [updated] = await sql`
        UPDATE trips
        SET country = ${country},
            country_code = ${countryCode},
            country_geocoded_at = now()
        WHERE id = ${trip.id}
        RETURNING id, country
      `;
      resolved.set(updated.id, updated.country);
    }

    if (resolved.size > 0) {
      rows = rows.map((r) =>
        resolved.has(r.id) ? { ...r, country: resolved.get(r.id) } : r
      );
    }

    return Response.json({ stats: computeTravelStats(rows) });
  } catch {
    return Response.json({
      stats: { trips: 0, nights: 0, countries: 0, cruiseNights: 0 },
    });
  }
}
