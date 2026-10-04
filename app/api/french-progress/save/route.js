import { getDb, num, dateOnly } from '../../../../lib/db';
import { isValidDate } from '../../../../lib/health';
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

  // Validate everything before writing anything: a confirmed preview is
  // saved whole or rejected whole, never skipped row by row.
  const validHours = (h) =>
    typeof h === 'number' && Number.isFinite(h) && h >= 0;
  const bad = (error) => Response.json({ error }, { status: 400 });

  if (totalHours != null) {
    if (!validHours(totalHours)) {
      return bad('totalHours must be a number of hours, 0 or more');
    }
    if (!asOfDate) return bad('totalHours requires an asOfDate');
    if (!isValidDate(asOfDate)) {
      return bad(`asOfDate "${asOfDate}" is not a valid YYYY-MM-DD date`);
    }
  }

  if (dailyEntries != null && !Array.isArray(dailyEntries)) {
    return bad('dailyEntries must be an array');
  }
  const entries = dailyEntries ?? [];
  for (const [i, entry] of entries.entries()) {
    if (!isValidDate(entry?.date)) {
      return bad(
        `dailyEntries[${i}]: "${entry?.date}" is not a valid YYYY-MM-DD date`
      );
    }
    if (!validHours(entry.hours)) {
      return bad(
        `dailyEntries[${i}] (${entry.date}): hours must be a number, 0 or more`
      );
    }
  }

  // One atomic transaction so a failure on any row leaves nothing saved.
  const writes = [];
  if (totalHours != null) {
    writes.push(sql`
      INSERT INTO french_hours_summary (id, total_hours, as_of_date)
      VALUES (1, ${totalHours}, ${asOfDate})
      ON CONFLICT (id) DO UPDATE SET
        total_hours = EXCLUDED.total_hours,
        as_of_date = EXCLUDED.as_of_date
    `);
  }
  for (const entry of entries) {
    writes.push(sql`
      INSERT INTO french_hours_daily (log_date, hours)
      VALUES (${entry.date}, ${entry.hours})
      ON CONFLICT (log_date) DO UPDATE SET hours = EXCLUDED.hours
    `);
  }
  if (writes.length) await sql.transaction(writes);

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
