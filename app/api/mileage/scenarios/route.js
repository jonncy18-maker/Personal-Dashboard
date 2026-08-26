import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const note = body.note || null;
  const impact1 = Number(body.impact_1yr) || 0;
  const impact2 = Number(body.impact_2yr) || 0;
  const impact3 = Number(body.impact_3yr) || 0;

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO mileage_scenarios (name, note, impact_1yr, impact_2yr, impact_3yr)
    VALUES (${name}, ${note}, ${impact1}, ${impact2}, ${impact3})
    RETURNING *
  `;
  return Response.json({ scenario: row }, { status: 201 });
});
