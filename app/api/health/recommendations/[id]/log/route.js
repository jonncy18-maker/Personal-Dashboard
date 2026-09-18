import { getDb, num, dateOnly } from '../../../../../../lib/db';
import { route } from '../../../../../../lib/route';
import { todayYMD } from '../../../../../../lib/health';

// Turns a meal-shaped recommendation into a fresh, independently-editable
// intake entry — mirrors app/api/health/favorites/[id]/log exactly. Unlike
// a favorite, a recommendation has no `source` of its own (it isn't logged
// food yet); the new entry gets 'estimated' since it's Claude's own number,
// never 'label'.

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

  const [rec] = await sql`
    SELECT * FROM health_recommended_meals WHERE id = ${id}
  `;
  if (!rec) {
    return Response.json(
      { error: 'recommendation not found' },
      { status: 404 }
    );
  }
  if (rec.calories == null) {
    return Response.json(
      { error: 'this recommendation has no calorie figure to log' },
      { status: 400 }
    );
  }

  const meal = body.meal || rec.meal;
  const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
  if (!MEALS.includes(meal)) {
    return Response.json(
      {
        error: 'this recommendation has no default meal — pass one explicitly',
      },
      { status: 400 }
    );
  }

  const entryDate = body.entry_date || todayYMD();
  const [row] = await sql`
    INSERT INTO health_intake_entries
      (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
       source, source_detail, logged_via)
    VALUES (${entryDate}, ${meal}, ${rec.title}, ${rec.calories},
            ${rec.protein_g}, ${rec.carbs_g}, ${rec.fat_g}, 'estimated',
            ${'from recommended meal: ' + rec.title},
            ${body.logged_via === 'mcp' ? 'mcp' : 'app'})
    RETURNING id, entry_date, meal, description, calories, protein_g,
              carbs_g, fat_g, source, source_detail, logged_via, created_at,
              updated_at
  `;
  return Response.json({ entry: shape(row) }, { status: 201 });
});
