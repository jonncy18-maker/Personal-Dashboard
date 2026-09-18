import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { todayYMD } from '../../../../lib/health';

// "Recommended meals" — Claude-curated nudges toward a healthier baseline,
// distinct from health_favorite_meals (things John already eats and saves
// himself). See .claude/skills/health for the full design. This route also
// backs the page's manual-add fallback (John can add one directly, without
// going through Claude).

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

function parseMacro(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid');
  return n;
}

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, horizon, for_date, title, detail, meal, calories, protein_g,
           carbs_g, fat_g, created_at
    FROM health_recommended_meals
    ORDER BY horizon ASC, for_date DESC, created_at DESC
  `;
  return Response.json({ recommendations: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();

  const title = (body.title || '').trim();
  const detail = (body.detail || '').trim();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  if (!detail) {
    return Response.json({ error: 'detail is required' }, { status: 400 });
  }
  if (!HORIZONS.includes(body.horizon)) {
    return Response.json(
      { error: `horizon must be one of ${HORIZONS.join(', ')}` },
      { status: 400 }
    );
  }
  if (body.meal != null && !MEALS.includes(body.meal)) {
    return Response.json({ error: 'invalid meal' }, { status: 400 });
  }

  // 'today' requires a for_date (defaults to today); 'ongoing' must not
  // have one — mirrors the DB CHECK constraint so a bad request 400s
  // cleanly instead of surfacing a raw constraint-violation error.
  const forDate = body.horizon === 'today' ? body.for_date || todayYMD() : null;

  let calories = null;
  if (body.calories != null && body.calories !== '') {
    calories = Number(body.calories);
    if (!Number.isFinite(calories) || calories < 0) {
      return Response.json(
        { error: 'calories must be a non-negative number' },
        { status: 400 }
      );
    }
    calories = Math.round(calories);
  }

  let proteinG;
  let carbsG;
  let fatG;
  try {
    proteinG = parseMacro(body.protein_g);
    carbsG = parseMacro(body.carbs_g);
    fatG = parseMacro(body.fat_g);
  } catch {
    return Response.json(
      { error: 'protein_g/carbs_g/fat_g must be non-negative numbers' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO health_recommended_meals
      (horizon, for_date, title, detail, meal, calories, protein_g, carbs_g, fat_g)
    VALUES (${body.horizon}, ${forDate}, ${title}, ${detail},
            ${body.meal || null}, ${calories}, ${proteinG}, ${carbsG}, ${fatG})
    RETURNING id, horizon, for_date, title, detail, meal, calories, protein_g,
              carbs_g, fat_g, created_at
  `;
  return Response.json({ recommendation: shape(row) }, { status: 201 });
});
