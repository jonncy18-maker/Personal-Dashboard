import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { todayYMD } from '../../../../lib/health';

// Weight readings — the dated log that is ground truth for both the trend and
// the target's weight input (the same role the odometer log plays for Car).
//
// One reading per calendar day: a POST for a date that already has one
// CORRECTS it rather than appending a second. Re-weighing after coffee is not
// a new data point, and two rows for one day would make "latest reading"
// ambiguous.

function shape(row) {
  return {
    ...row,
    reading_date: dateOnly(row.reading_date),
    weight_lb: num(row.weight_lb),
  };
}

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, reading_date, weight_lb, note, created_at, updated_at
    FROM health_weight_readings
    ORDER BY reading_date DESC
  `;
  return Response.json({ readings: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const weight = Number(body.weight_lb);

  if (!Number.isFinite(weight) || weight <= 0) {
    return Response.json(
      { error: 'weight_lb must be a positive number' },
      { status: 400 }
    );
  }

  const readingDate = body.reading_date || todayYMD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
    return Response.json(
      { error: 'reading_date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO health_weight_readings (reading_date, weight_lb, note)
    VALUES (${readingDate}, ${weight}, ${body.note || null})
    ON CONFLICT (reading_date) DO UPDATE
      SET weight_lb = EXCLUDED.weight_lb,
          note      = EXCLUDED.note
    RETURNING id, reading_date, weight_lb, note, created_at, updated_at
  `;
  return Response.json({ reading: shape(row) }, { status: 201 });
});
