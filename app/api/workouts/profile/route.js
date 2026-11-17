import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { parseOptionalNumber } from '../../../../lib/workouts';

// Goals and constraints are John's own words, kept as data so the page and
// both AI clients read the same thing. Only the fields sent are changed.

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export const PATCH = route(async (request) => {
  const body = await request.json();
  const sql = getDb();
  const [current] = await sql`
    SELECT goals, constraints, target_minutes FROM workout_profile WHERE id = 1
  `;
  const next = {
    goals: null,
    constraints: null,
    target_minutes: null,
    ...current,
  };

  if ('goals' in body) next.goals = text(body.goals);
  if ('constraints' in body) next.constraints = text(body.constraints);
  if ('target_minutes' in body) {
    const minutes = parseOptionalNumber(body.target_minutes, {
      min: 1,
      integer: true,
    });
    if (minutes === undefined) {
      return Response.json(
        { error: 'target_minutes must be a positive whole number' },
        { status: 400 }
      );
    }
    next.target_minutes = minutes;
  }

  const [row] = await sql`
    INSERT INTO workout_profile (id, goals, constraints, target_minutes)
    VALUES (1, ${next.goals}, ${next.constraints}, ${next.target_minutes})
    ON CONFLICT (id) DO UPDATE SET
      goals = EXCLUDED.goals,
      constraints = EXCLUDED.constraints,
      target_minutes = EXCLUDED.target_minutes,
      updated_at = now()
    RETURNING goals, constraints, target_minutes
  `;
  return Response.json({ profile: row });
});
