import { getDb, dateOnly } from '../../../lib/db';

// Pending trip suggestions produced by the weekly scan (app/api/trip-scan).
// The Travel banner, the Home Travel-card warning, and the top-bar bell all
// read this to know how many trips are waiting for John's review.
export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, destination, start_date, end_date, source_gmail_id,
           source_subject, created_at
    FROM trip_suggestions
    WHERE status = 'pending'
    ORDER BY start_date IS NULL, start_date ASC, created_at DESC
  `;
  const suggestions = rows.map((r) => ({
    ...r,
    start_date: dateOnly(r.start_date),
    end_date: dateOnly(r.end_date),
  }));
  return Response.json({ suggestions, count: suggestions.length });
}
