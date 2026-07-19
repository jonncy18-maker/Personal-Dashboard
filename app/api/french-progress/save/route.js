import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// Commits what John confirmed in the screenshot-import preview (never what
// Haiku returned raw — see lib/french-progress.js). totalHours/asOfDate
// upsert the singleton summary row; dailyEntries upsert into the log, keyed
// by date, so re-importing an overlapping screenshot just corrects those
// days rather than duplicating them.
export const POST = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const { totalHours, asOfDate, dailyEntries } = body;
  const sql = getDb();

  if (totalHours != null) {
    if (typeof totalHours !== 'number' || !asOfDate) {
      return Response.json(
        { error: 'totalHours requires an asOfDate' },
        { status: 400 }
      );
    }
    await sql`
      INSERT INTO french_hours_summary (id, total_hours, as_of_date)
      VALUES (1, ${totalHours}, ${asOfDate})
      ON CONFLICT (id) DO UPDATE SET
        total_hours = EXCLUDED.total_hours,
        as_of_date = EXCLUDED.as_of_date
    `;
  }

  const entries = Array.isArray(dailyEntries) ? dailyEntries : [];
  for (const entry of entries) {
    if (!entry?.date || typeof entry.hours !== 'number') continue;
    await sql`
      INSERT INTO french_hours_daily (log_date, hours)
      VALUES (${entry.date}, ${entry.hours})
      ON CONFLICT (log_date) DO UPDATE SET hours = EXCLUDED.hours
    `;
  }

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
