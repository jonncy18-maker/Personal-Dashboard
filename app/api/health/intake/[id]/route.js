import { getDb, num, dateOnly } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';

// Correcting or removing a single intake entry. Editing a calorie figure by
// hand makes it John's own number, so a PATCH that touches `calories` without
// naming a new `source` re-tiers the row to 'estimated' rather than letting it
// keep a 'label' badge it no longer earns.

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCES = ['label', 'recall', 'estimated'];

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [current] = await sql`
    SELECT * FROM health_intake_entries WHERE id = ${id}
  `;
  if (!current) {
    return Response.json({ error: 'entry not found' }, { status: 404 });
  }

  if (body.meal != null && !MEALS.includes(body.meal)) {
    return Response.json({ error: 'invalid meal' }, { status: 400 });
  }
  if (body.source != null && !SOURCES.includes(body.source)) {
    return Response.json({ error: 'invalid source' }, { status: 400 });
  }

  let calories = current.calories;
  if (body.calories != null) {
    const parsed = Number(body.calories);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Response.json({ error: 'invalid calories' }, { status: 400 });
    }
    calories = Math.round(parsed);
  }

  const caloriesChanged = calories !== current.calories;
  const source =
    body.source ??
    (caloriesChanged && current.source === 'label'
      ? 'estimated'
      : current.source);

  // Macros follow the same "only touch what's named" rule as every other
  // field here: omitted keeps the stored value, `null`/`''` clears it. A
  // macro field is never required, unlike calories.
  function resolveMacro(key) {
    if (!(key in body)) return current[key];
    if (body[key] == null || body[key] === '') return null;
    const n = Number(body[key]);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return n;
  }
  const proteinG = resolveMacro('protein_g');
  const carbsG = resolveMacro('carbs_g');
  const fatG = resolveMacro('fat_g');
  if (proteinG === undefined || carbsG === undefined || fatG === undefined) {
    return Response.json(
      { error: 'protein_g/carbs_g/fat_g must be non-negative numbers' },
      { status: 400 }
    );
  }

  const [row] = await sql`
    UPDATE health_intake_entries
    SET meal          = ${body.meal ?? current.meal},
        description   = ${(body.description ?? current.description).trim()},
        calories      = ${calories},
        protein_g     = ${proteinG},
        carbs_g       = ${carbsG},
        fat_g         = ${fatG},
        source        = ${source},
        source_detail = ${body.source_detail ?? current.source_detail}
    WHERE id = ${id}
    RETURNING id, entry_date, meal, description, calories, protein_g,
              carbs_g, fat_g, source, source_detail, logged_via, created_at,
              updated_at
  `;
  return Response.json({
    entry: {
      ...row,
      entry_date: dateOnly(row.entry_date),
      protein_g: num(row.protein_g),
      carbs_g: num(row.carbs_g),
      fat_g: num(row.fat_g),
    },
  });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_intake_entries WHERE id = ${id} RETURNING id
  `;
  if (!row) {
    return Response.json({ error: 'entry not found' }, { status: 404 });
  }
  return Response.json({ deleted: row.id });
});
