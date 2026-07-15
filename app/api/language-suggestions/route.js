import { getDb } from '../../../lib/db';

// Pending italki bookings produced by the weekly scan (app/api/language-scan).
// The Language page's review banner reads this to know what's waiting.
export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, tutor, start_at, source_subject, created_at
    FROM language_calls
    WHERE status = 'pending'
    ORDER BY start_at ASC
  `;
  return Response.json({ suggestions: rows, count: rows.length });
}
