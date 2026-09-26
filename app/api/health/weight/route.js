import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { deviceToday } from '../../../../lib/device-time';

// Weight + steps readings — one dated row per calendar day (migration 030
// added `steps` alongside the original weight-only log). weight_lb is ground
// truth for both the trend and the target's weight input, the same role the
// odometer log plays for Car. `steps` is display/log-only — never fed into
// any calorie math (see that migration's comment: the activity multiplier
// already assumes a general activity level, and wearables overestimate
// active burn, so crediting steps back would double-count).
//
// One row per calendar day: a POST for a date that already has one CORRECTS
// it rather than appending a second. Re-weighing after coffee, or logging
// steps again after a later sync, is not a new data point.
//
// Read-merge-write, not COALESCE-in-SQL: a field the caller omits must keep
// its stored value, a field the caller doesn't have yet (first row for a
// steps-only day) must not require the other. Same shape as the
// health_profile PATCH's own read-merge-write, and for the same reason.

function shape(row) {
  return {
    ...row,
    reading_date: dateOnly(row.reading_date),
    weight_lb: num(row.weight_lb),
    steps: row.steps == null ? null : Number(row.steps),
  };
}

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, reading_date, weight_lb, steps, note, created_at, updated_at
    FROM health_weight_readings
    ORDER BY reading_date DESC
  `;
  return Response.json({ readings: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();

  const hasWeight = body.weight_lb != null && body.weight_lb !== '';
  const hasSteps = body.steps != null && body.steps !== '';
  if (!hasWeight && !hasSteps) {
    return Response.json(
      { error: 'weight_lb or steps is required' },
      { status: 400 }
    );
  }

  let weight = null;
  if (hasWeight) {
    weight = Number(body.weight_lb);
    if (!Number.isFinite(weight) || weight <= 0) {
      return Response.json(
        { error: 'weight_lb must be a positive number' },
        { status: 400 }
      );
    }
  }

  let steps = null;
  if (hasSteps) {
    steps = Math.round(Number(body.steps));
    if (!Number.isFinite(steps) || steps < 0) {
      return Response.json(
        { error: 'steps must be a non-negative number' },
        { status: 400 }
      );
    }
  }

  const readingDate = body.reading_date || (await deviceToday());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
    return Response.json(
      { error: 'reading_date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [current] = await sql`
    SELECT weight_lb, steps, note FROM health_weight_readings
    WHERE reading_date = ${readingDate}
  `;
  const nextWeight = hasWeight ? weight : (current?.weight_lb ?? null);
  const nextSteps = hasSteps ? steps : (current?.steps ?? null);
  const nextNote =
    body.note !== undefined ? body.note || null : (current?.note ?? null);

  const [row] = await sql`
    INSERT INTO health_weight_readings (reading_date, weight_lb, steps, note)
    VALUES (${readingDate}, ${nextWeight}, ${nextSteps}, ${nextNote})
    ON CONFLICT (reading_date) DO UPDATE
      SET weight_lb = ${nextWeight},
          steps     = ${nextSteps},
          note      = ${nextNote}
    RETURNING id, reading_date, weight_lb, steps, note, created_at, updated_at
  `;
  return Response.json({ reading: shape(row) }, { status: 201 });
});
