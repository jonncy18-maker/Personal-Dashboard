import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';

// French hours log — reads what's been imported/confirmed via the
// screenshot-import flow (see app/api/french-progress/import + save).
export const GET = route(async () => {
  const sql = getDb();
  const [summary] = await sql`
    SELECT total_hours, as_of_date FROM french_hours_summary WHERE id = 1
  `;
  const recent = await sql`
    SELECT log_date, hours FROM french_hours_daily
    ORDER BY log_date DESC LIMIT 30
  `;

  return Response.json({
    totalHours: summary ? num(summary.total_hours) : null,
    asOfDate: summary ? dateOnly(summary.as_of_date) : null,
    recent: recent.map((r) => ({
      date: dateOnly(r.log_date),
      hours: num(r.hours),
    })),
  });
});
