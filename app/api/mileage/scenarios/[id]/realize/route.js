import { getDb } from '../../../../../../lib/db';
import { route, jsonError } from '../../../../../../lib/route';

// Marks one occurrence of a one-time scenario "taken" (or undoes a misclick
// with delta: -1) — the click behind the Mileage tab's "Mark a trip taken"
// button. Never accepts a raw realized_count from the client: only ever
// moves the counter by the given delta, clamped to [0, occurrence_count], so
// it can't be pushed out of range or used to hand-edit the scenario's real
// numbers (those stay on PATCH .../scenarios/[id]).
export const POST = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const delta = Number.isFinite(Number(body.delta)) ? Number(body.delta) : 1;
  const sql = getDb();

  const [existing] =
    await sql`SELECT * FROM mileage_scenarios WHERE id = ${id}`;
  if (!existing) return jsonError('not found', 404);
  if (existing.occurrence !== 'one_time') {
    return jsonError('only a one-time scenario can be realized', 400);
  }
  const count = Number(existing.occurrence_count) || 0;
  if (!count) {
    return jsonError('this scenario has no trip count set', 400);
  }

  const next = Math.min(
    count,
    Math.max(0, Number(existing.realized_count) + delta)
  );

  const [row] = await sql`
    UPDATE mileage_scenarios SET realized_count = ${next}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json({ scenario: row });
});
