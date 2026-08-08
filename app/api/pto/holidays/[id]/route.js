import { getDb, dateOnly } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

function serialize(row) {
  return { ...row, holiday_date: dateOnly(row.holiday_date) };
}

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM pto_holidays WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const holidayDate =
    body.holiday_date !== undefined
      ? body.holiday_date
      : dateOnly(existing.holiday_date);
  if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    return Response.json({ error: 'invalid holiday_date' }, { status: 400 });
  }
  const name =
    body.name !== undefined ? (body.name || '').trim() : existing.name;
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const worked =
    body.worked !== undefined ? Boolean(body.worked) : existing.worked;

  const [row] = await sql`
    UPDATE pto_holidays
    SET holiday_date = ${holidayDate}, name = ${name}, worked = ${worked}
    WHERE id = ${id}
    RETURNING id, holiday_date, name, worked
  `;
  return Response.json({ holiday: serialize(row) });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM pto_holidays WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
