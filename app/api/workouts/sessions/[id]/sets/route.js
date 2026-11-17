import { getDb } from '../../../../../../lib/db';
import { route } from '../../../../../../lib/route';
import {
  insertSets,
  isUuid,
  loadSession,
  validateSets,
} from '../../../../../../lib/workouts-data';

// Appends one set (`{ exercise_id, weight_lb, reps, … }`) or several
// (`{ sets: [...] }`) to a session. Set numbers continue per exercise.
export const POST = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [session] = isUuid(id)
    ? await sql`SELECT id FROM workout_sessions WHERE id = ${id}`
    : [];
  if (!session) {
    return Response.json({ error: 'session not found' }, { status: 404 });
  }
  const body = await request.json();
  const raw = Array.isArray(body.sets) ? body.sets : [body];
  const { sets, error } = await validateSets(sql, raw);
  if (error) return Response.json({ error }, { status: 400 });
  if (sets.length === 0) {
    return Response.json({ error: 'no sets given' }, { status: 400 });
  }
  await insertSets(sql, id, sets);
  // Logging real sets means the details are no longer missing.
  await sql`
    UPDATE workout_sessions SET details_complete = true
    WHERE id = ${id} AND details_complete = false
  `;
  return Response.json(
    { session: await loadSession(sql, id) },
    { status: 201 }
  );
});
