import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';

function serialize(row) {
  return { ...row, holiday_date: dateOnly(row.holiday_date) };
}

export const POST = route(async (request) => {
  const body = await request.json();
  const holidayDate = body.holiday_date;
  const name = (body.name || '').trim();
  if (!holidayDate || !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate)) {
    return Response.json(
      { error: 'holiday_date is required' },
      { status: 400 }
    );
  }
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const worked = body.worked === true;

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO pto_holidays (holiday_date, name, worked)
    VALUES (${holidayDate}, ${name}, ${worked})
    ON CONFLICT (holiday_date) DO UPDATE SET name = EXCLUDED.name, worked = EXCLUDED.worked
    RETURNING id, holiday_date, name, worked
  `;
  return Response.json({ holiday: serialize(row) }, { status: 201 });
});
