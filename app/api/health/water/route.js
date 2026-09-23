import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { todayYMD, toWaterOunces, WATER_UNITS } from '../../../../lib/health';

// Water, one row per drink (migration 036). A drink is its own log, never an
// intake row, so it can't count toward "N of 4 meals logged". POST always
// appends — the day's figure is the SUM of its drinks — and takes an
// amount + unit (oz / cup / ml), stored as US fl oz.

function shape(row) {
  return {
    ...row,
    entry_date: dateOnly(row.entry_date),
    ounces: num(row.ounces),
  };
}

export const GET = route(async (request) => {
  const date = new URL(request.url).searchParams.get('date') || todayYMD();
  const sql = getDb();
  const rows = await sql`
    SELECT id, entry_date, ounces, logged_via, created_at
    FROM health_water_entries
    WHERE entry_date = ${date}
    ORDER BY created_at ASC
  `;
  return Response.json({ entries: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const unit = body.unit || 'oz';
  const ounces = toWaterOunces(body.amount, unit);
  if (ounces == null) {
    return Response.json(
      {
        error: `amount must be a positive number and unit one of ${WATER_UNITS.join(', ')}`,
      },
      { status: 400 }
    );
  }
  const entryDate = body.entry_date || todayYMD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return Response.json(
      { error: 'entry_date must be YYYY-MM-DD' },
      { status: 400 }
    );
  }
  const loggedVia = body.logged_via === 'mcp' ? 'mcp' : 'app';

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO health_water_entries (entry_date, ounces, logged_via)
    VALUES (${entryDate}, ${ounces}, ${loggedVia})
    RETURNING id, entry_date, ounces, logged_via, created_at
  `;
  return Response.json({ entry: shape(row) }, { status: 201 });
});
