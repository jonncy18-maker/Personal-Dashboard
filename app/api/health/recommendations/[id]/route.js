import { getDb, num, dateOnly } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { todayYMD } from '../../../../../lib/health';

const HORIZONS = ['today', 'ongoing'];
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];

function shape(row) {
  return {
    ...row,
    for_date: dateOnly(row.for_date),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
  };
}

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [current] = await sql`
    SELECT * FROM health_recommended_meals WHERE id = ${id}
  `;
  if (!current) {
    return Response.json(
      { error: 'recommendation not found' },
      { status: 404 }
    );
  }

  if (body.horizon != null && !HORIZONS.includes(body.horizon)) {
    return Response.json({ error: 'invalid horizon' }, { status: 400 });
  }
  if (body.meal != null && body.meal !== '' && !MEALS.includes(body.meal)) {
    return Response.json({ error: 'invalid meal' }, { status: 400 });
  }

  const horizon = body.horizon ?? current.horizon;
  // Switching horizon must keep for_date consistent with the same CHECK
  // constraint the DB enforces — 'today' needs one, 'ongoing' must not.
  let forDate;
  if ('for_date' in body || 'horizon' in body) {
    if (horizon === 'today') {
      forDate = body.for_date || dateOnly(current.for_date) || todayYMD();
    } else {
      forDate = null;
    }
  } else {
    forDate = dateOnly(current.for_date);
  }

  function resolveMacro(key) {
    if (!(key in body)) return current[key];
    if (body[key] == null || body[key] === '') return null;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  }
  const calories = resolveMacro('calories');
  const proteinG = resolveMacro('protein_g');
  const carbsG = resolveMacro('carbs_g');
  const fatG = resolveMacro('fat_g');
  if (
    calories === undefined ||
    proteinG === undefined ||
    carbsG === undefined ||
    fatG === undefined
  ) {
    return Response.json(
      {
        error: 'calories/protein_g/carbs_g/fat_g must be non-negative numbers',
      },
      { status: 400 }
    );
  }

  const title = (body.title ?? current.title).trim();
  const detail = (body.detail ?? current.detail).trim();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  if (!detail) {
    return Response.json({ error: 'detail is required' }, { status: 400 });
  }

  const [row] = await sql`
    UPDATE health_recommended_meals
    SET horizon    = ${horizon},
        for_date   = ${forDate},
        title      = ${title},
        detail     = ${detail},
        meal       = ${body.meal === '' ? null : (body.meal ?? current.meal)},
        calories   = ${calories},
        protein_g  = ${proteinG},
        carbs_g    = ${carbsG},
        fat_g      = ${fatG}
    WHERE id = ${id}
    RETURNING id, horizon, for_date, title, detail, meal, calories, protein_g,
              carbs_g, fat_g, created_at
  `;
  return Response.json({ recommendation: shape(row) });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_recommended_meals WHERE id = ${id} RETURNING id
  `;
  if (!row) {
    return Response.json(
      { error: 'recommendation not found' },
      { status: 404 }
    );
  }
  return Response.json({ deleted: row.id });
});
