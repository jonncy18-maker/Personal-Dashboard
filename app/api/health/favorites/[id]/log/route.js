import { getDb, num, dateOnly } from '../../../../../../lib/db';
import { route } from '../../../../../../lib/route';
import { deviceToday } from '../../../../../../lib/device-time';
import { parseFruitServings } from '../../../../../../lib/health';

// Turns a saved favorite into a fresh, independently-editable intake entry —
// a one-tap re-log of a meal that repeats verbatim (e.g. the same breakfast
// every day). The new row is a full copy, not a reference: editing or
// deleting it later never touches the favorite template.

function shape(row) {
  return {
    ...row,
    entry_date: dateOnly(row.entry_date),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    fiber_g: num(row.fiber_g),
    saturated_fat_g: num(row.saturated_fat_g),
    veggie_servings: num(row.veggie_servings),
    fruit_servings: num(row.fruit_servings),
    fluid_oz: num(row.fluid_oz),
  };
}

export const POST = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const sql = getDb();

  const [favorite] = await sql`
    SELECT * FROM health_favorite_meals WHERE id = ${id}
  `;
  if (!favorite) {
    return Response.json({ error: 'favorite not found' }, { status: 404 });
  }

  const meal = body.meal || favorite.meal;
  const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!MEALS.includes(meal)) {
    return Response.json(
      { error: 'favorite has no default meal — pass one explicitly' },
      { status: 400 }
    );
  }

  const entryDate = body.entry_date || (await deviceToday());
  function nutrient(key) {
    if (!(key in body)) return num(favorite[key]);
    if (body[key] == null || body[key] === '') return null;
    const n = Number(body[key]);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
  const fiberG = nutrient('fiber_g');
  const saturatedFatG = nutrient('saturated_fat_g');
  const fruitServings =
    'fruit_servings' in body
      ? parseFruitServings(body.fruit_servings)
      : num(favorite.fruit_servings);
  if ([fiberG, saturatedFatG, fruitServings].some((n) => n === undefined)) {
    return Response.json(
      { error: 'invalid nutrient or fruit servings' },
      { status: 400 }
    );
  }
  const [row] = await sql`
    INSERT INTO health_intake_entries
      (entry_date, meal, description, calories, protein_g, carbs_g, fat_g, fiber_g, saturated_fat_g,
       veggie_servings, fruit_servings, fluid_oz, source, source_detail, logged_via)
    VALUES (${entryDate}, ${meal}, ${favorite.description}, ${favorite.calories},
            ${favorite.protein_g}, ${favorite.carbs_g}, ${favorite.fat_g},
            ${fiberG}, ${saturatedFatG},
            ${favorite.veggie_servings}, ${fruitServings}, ${favorite.fluid_oz}, ${favorite.source},
            ${favorite.source_detail},
            ${body.logged_via === 'mcp' ? 'mcp' : 'app'})
    RETURNING id, entry_date, meal, description, calories, protein_g,
              carbs_g, fat_g, fiber_g, saturated_fat_g, veggie_servings, fruit_servings, fluid_oz, source, source_detail,
              logged_via, created_at,
              updated_at
  `;
  return Response.json({ entry: shape(row) }, { status: 201 });
});
