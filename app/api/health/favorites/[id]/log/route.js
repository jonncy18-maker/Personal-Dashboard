import { getDb, num, dateOnly } from '../../../../../../lib/db';
import { route } from '../../../../../../lib/route';
import { todayYMD } from '../../../../../../lib/health';

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

  const entryDate = body.entry_date || todayYMD();
  const [row] = await sql`
    INSERT INTO health_intake_entries
      (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
       source, source_detail, logged_via)
    VALUES (${entryDate}, ${meal}, ${favorite.description}, ${favorite.calories},
            ${favorite.protein_g}, ${favorite.carbs_g}, ${favorite.fat_g},
            ${favorite.source}, ${favorite.source_detail},
            ${body.logged_via === 'mcp' ? 'mcp' : 'app'})
    RETURNING id, entry_date, meal, description, calories, protein_g,
              carbs_g, fat_g, source, source_detail, logged_via, created_at,
              updated_at
  `;
  return Response.json({ entry: shape(row) }, { status: 201 });
});
