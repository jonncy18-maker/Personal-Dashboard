import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// Odometer log entries — the ground truth for cumulative miles (lib/mileage.js
// never sums mileage_trips into this). One reading per date; logging a second
// reading for a date already logged corrects it (upsert), matching French
// Hours' "re-imported overlapping screenshot just corrects those days" rule.

export const POST = route(async (request) => {
  const body = await request.json();
  const readingDate = body.reading_date;
  const odometer = Number(body.odometer);

  if (!readingDate || !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
    return Response.json(
      { error: 'reading_date is required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(odometer) || odometer < 0) {
    return Response.json(
      { error: 'odometer must be a non-negative number' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO mileage_readings (reading_date, odometer)
    VALUES (${readingDate}, ${odometer})
    ON CONFLICT (reading_date) DO UPDATE SET odometer = EXCLUDED.odometer
    RETURNING id, reading_date, odometer
  `;
  return Response.json(
    { reading: { ...row, reading_date: dateOnly(row.reading_date) } },
    { status: 201 }
  );
});
