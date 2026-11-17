import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { EQUIPMENT } from '../../../../lib/workouts';
import { loadExercises } from '../../../../lib/workouts-data';

export const GET = route(async () => {
  return Response.json({ exercises: await loadExercises(getDb()) });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (!EQUIPMENT.includes(body.equipment)) {
    return Response.json(
      { error: `equipment must be one of ${EQUIPMENT.join(', ')}` },
      { status: 400 }
    );
  }
  const sql = getDb();
  const [existing] = await sql`
    SELECT id, name FROM workout_exercises WHERE lower(name) = lower(${name})
  `;
  if (existing) {
    return Response.json(
      { error: `"${existing.name}" already exists`, id: existing.id },
      { status: 409 }
    );
  }
  const [row] = await sql`
    INSERT INTO workout_exercises (name, equipment, muscle_group, unilateral, notes)
    VALUES (${name}, ${body.equipment}, ${(body.muscle_group || '').trim() || null},
            ${body.unilateral === true}, ${(body.notes || '').trim() || null})
    RETURNING id, name, equipment, muscle_group, unilateral, notes, archived_at
  `;
  return Response.json({ exercise: row }, { status: 201 });
});
