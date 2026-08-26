import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

// PATCH covers both editing a scenario's fields and toggling `active` — the
// same route, since the page only ever sends the fields that changed.
export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] =
    await sql`SELECT * FROM mileage_scenarios WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const name =
    body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const note = body.note !== undefined ? body.note || null : existing.note;
  const active = body.active !== undefined ? !!body.active : existing.active;
  const impact1 =
    body.impact_1yr !== undefined
      ? Number(body.impact_1yr) || 0
      : existing.impact_1yr;
  const impact2 =
    body.impact_2yr !== undefined
      ? Number(body.impact_2yr) || 0
      : existing.impact_2yr;
  const impact3 =
    body.impact_3yr !== undefined
      ? Number(body.impact_3yr) || 0
      : existing.impact_3yr;

  const [row] = await sql`
    UPDATE mileage_scenarios SET
      name = ${name}, note = ${note}, active = ${active},
      impact_1yr = ${impact1}, impact_2yr = ${impact2}, impact_3yr = ${impact3},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json({ scenario: row });
});

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM mileage_scenarios WHERE id = ${id}`;
  return Response.json({ ok: true });
});
