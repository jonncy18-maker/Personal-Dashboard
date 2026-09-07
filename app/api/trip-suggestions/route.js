import { getDb, dateOnly } from '../../../lib/db';
import { findMergeCandidates } from '../../../lib/trip-merge';

// Pending trip suggestions produced by the weekly scan (app/api/trip-scan).
// The Travel banner, the Home Travel-card warning, and the top-bar bell all
// read this to know how many trips are waiting for John's review.
//
// Each suggestion is also enriched with `merge_candidates`: existing trips
// whose dates are close enough (see lib/trip-merge.js) that this suggestion
// is probably another leg of the same journey rather than a new trip — e.g.
// a Cebu confirmation landing a day after an already-approved Singapore
// flight. This only surfaces a heuristic; nothing merges without John
// picking a candidate in the review popup.
export async function GET() {
  const sql = getDb();
  const [rows, existingTrips] = await Promise.all([
    sql`
      SELECT id, destination, start_date, end_date, source_gmail_id,
             source_subject, created_at
      FROM trip_suggestions
      WHERE status = 'pending'
      ORDER BY start_date IS NULL, start_date ASC, created_at DESC
    `,
    sql`
      SELECT id, destination, start_date, end_date, status, merged_into_id
      FROM trips
    `,
  ]);
  const trips = existingTrips.map((t) => ({
    ...t,
    start_date: dateOnly(t.start_date),
    end_date: dateOnly(t.end_date),
  }));
  const suggestions = rows.map((r) => {
    const start_date = dateOnly(r.start_date);
    const end_date = dateOnly(r.end_date);
    return {
      ...r,
      start_date,
      end_date,
      merge_candidates: findMergeCandidates({ start_date, end_date }, trips),
    };
  });
  return Response.json({ suggestions, count: suggestions.length });
}
