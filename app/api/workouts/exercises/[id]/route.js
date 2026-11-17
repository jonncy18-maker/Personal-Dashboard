import { dateOnly, getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { EQUIPMENT, exerciseProgress } from '../../../../../lib/workouts';
import { isUuid, shapeSet } from '../../../../../lib/workouts-data';

const notFound = () =>
  Response.json({ error: 'exercise not found' }, { status: 404 });

// One exercise with its full history: one point per session, oldest first.
export const GET = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const sql = getDb();
  const [exercise] = await sql`
    SELECT id, name, equipment, muscle_group, unilateral, notes, archived_at
    FROM workout_exercises WHERE id = ${id}
  `;
  if (!exercise) return notFound();
  const rows = await sql`
    SELECT st.id, st.session_id, st.set_number, st.weight_lb, st.reps,
           st.per_side, st.notes, se.session_date
    FROM workout_sets st
    JOIN workout_sessions se ON se.id = st.session_id
    WHERE st.exercise_id = ${id}
  `;
  const history = exerciseProgress(
    rows.map((r) => ({
      ...shapeSet(r),
      session_date: dateOnly(r.session_date),
    }))
  );
  return Response.json({ exercise, history });
});

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await request.json();
  const sql = getDb();
  const [current] = await sql`SELECT * FROM workout_exercises WHERE id = ${id}`;
  if (!current) return notFound();

  const next = { ...current };
  if ('name' in body) {
    next.name = (body.name || '').trim();
    if (!next.name) {
      return Response.json({ error: 'name cannot be blank' }, { status: 400 });
    }
    const [clash] = await sql`
      SELECT id FROM workout_exercises
      WHERE lower(name) = lower(${next.name}) AND id <> ${id}
    `;
    if (clash) {
      return Response.json(
        { error: 'another exercise already has that name', id: clash.id },
        { status: 409 }
      );
    }
  }
  if ('equipment' in body) {
    if (!EQUIPMENT.includes(body.equipment)) {
      return Response.json(
        { error: `equipment must be one of ${EQUIPMENT.join(', ')}` },
        { status: 400 }
      );
    }
    next.equipment = body.equipment;
  }
  if ('muscle_group' in body) {
    next.muscle_group = (body.muscle_group || '').trim() || null;
  }
  if ('unilateral' in body) next.unilateral = body.unilateral === true;
  if ('notes' in body) next.notes = (body.notes || '').trim() || null;
  if ('archived' in body) {
    next.archived_at = body.archived === true ? new Date().toISOString() : null;
  }

  const [row] = await sql`
    UPDATE workout_exercises SET
      name = ${next.name}, equipment = ${next.equipment},
      muscle_group = ${next.muscle_group}, unilateral = ${next.unilateral},
      notes = ${next.notes}, archived_at = ${next.archived_at}
    WHERE id = ${id}
    RETURNING id, name, equipment, muscle_group, unilateral, notes, archived_at
  `;
  return Response.json({ exercise: row });
});

// An exercise with logged sets is archived so its history keeps a name; one
// that was never logged is removed outright. Either way it leaves templates.
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const sql = getDb();
  const [exercise] =
    await sql`SELECT id FROM workout_exercises WHERE id = ${id}`;
  if (!exercise) return notFound();
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM workout_sets WHERE exercise_id = ${id}
  `;
  await sql`DELETE FROM workout_template_exercises WHERE exercise_id = ${id}`;
  if (n > 0) {
    await sql`UPDATE workout_exercises SET archived_at = now() WHERE id = ${id}`;
    return Response.json({ archived: id, logged_sets: n });
  }
  await sql`DELETE FROM workout_exercises WHERE id = ${id}`;
  return Response.json({ deleted: id });
});
