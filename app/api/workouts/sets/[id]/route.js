import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { parseOptionalNumber, parsePerSide } from '../../../../../lib/workouts';
import { isUuid, shapeSet } from '../../../../../lib/workouts-data';

const notFound = () =>
  Response.json({ error: 'set not found' }, { status: 404 });

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await request.json();
  const sql = getDb();
  const [current] = await sql`SELECT * FROM workout_sets WHERE id = ${id}`;
  if (!current) return notFound();

  const next = { ...current };
  if ('weight_lb' in body) {
    next.weight_lb = parseOptionalNumber(body.weight_lb);
    if (next.weight_lb === undefined) {
      return Response.json(
        { error: 'weight_lb must be a non-negative number' },
        { status: 400 }
      );
    }
  }
  if ('reps' in body) {
    next.reps = parseOptionalNumber(body.reps, { integer: true });
    if (next.reps === undefined) {
      return Response.json(
        { error: 'reps must be a non-negative whole number' },
        { status: 400 }
      );
    }
  }
  if ('per_side' in body) {
    next.per_side = parsePerSide(body.per_side);
    if (next.per_side === undefined) {
      return Response.json(
        { error: 'per_side must be true, false or null' },
        { status: 400 }
      );
    }
  }
  if ('notes' in body) next.notes = (body.notes || '').trim() || null;

  const [row] = await sql`
    UPDATE workout_sets SET
      weight_lb = ${next.weight_lb}, reps = ${next.reps},
      per_side = ${next.per_side}, notes = ${next.notes}
    WHERE id = ${id}
    RETURNING id, session_id, exercise_id, set_number, weight_lb, reps,
              per_side, notes
  `;
  return Response.json({ set: shapeSet(row) });
});

// Removing a set closes the gap so the rest stay numbered 1..n.
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM workout_sets WHERE id = ${id}
    RETURNING id, session_id, exercise_id, set_number
  `;
  if (!row) return notFound();
  await sql`
    UPDATE workout_sets SET set_number = set_number - 1
    WHERE session_id = ${row.session_id} AND exercise_id = ${row.exercise_id}
      AND set_number > ${row.set_number}
  `;
  return Response.json({ deleted: row.id });
});
