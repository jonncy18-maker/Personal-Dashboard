import { getDb, num } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { parseVeggieServings, parseFluidOz } from '../../../../lib/health';

// Saved meal templates for something that repeats verbatim (e.g. the same
// breakfast every day) — see .claude/skills/health. Logging one is a
// separate action (POST /api/health/favorites/[id]/log) that copies these
// fields into a fresh health_intake_entries row; this route only manages the
// templates themselves.

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCES = ['label', 'recall', 'estimated'];

function shape(row) {
  return {
    ...row,
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    veggie_servings: num(row.veggie_servings),
    fluid_oz: num(row.fluid_oz),
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
    SELECT id, name, meal, description, calories, protein_g, carbs_g, fat_g,
           veggie_servings, fluid_oz, source, source_detail, created_at
    FROM health_favorite_meals
    ORDER BY created_at ASC
  `;
  return Response.json({ favorites: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();

  const name = (body.name || '').trim();
  const description = (body.description || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (!description) {
    return Response.json({ error: 'description is required' }, { status: 400 });
  }
  if (body.meal != null && !MEALS.includes(body.meal)) {
    return Response.json({ error: 'invalid meal' }, { status: 400 });
  }
  if (!SOURCES.includes(body.source)) {
    return Response.json(
      { error: `source must be one of ${SOURCES.join(', ')}` },
      { status: 400 }
    );
  }
  const calories = Number(body.calories);
  if (!Number.isFinite(calories) || calories < 0) {
    return Response.json(
      { error: 'calories must be a non-negative number' },
      { status: 400 }
    );
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

  const veggieServings = parseVeggieServings(body.veggie_servings);
  if (veggieServings === undefined) {
    return Response.json(
      { error: 'veggie_servings must be a non-negative number' },
      { status: 400 }
    );
  }

  const fluidOz = parseFluidOz(body.fluid_oz);
  if (fluidOz === undefined) {
    return Response.json(
      { error: 'fluid_oz must be a positive number' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO health_favorite_meals
      (name, meal, description, calories, protein_g, carbs_g, fat_g,
       veggie_servings, fluid_oz, source, source_detail)
    VALUES (${name}, ${body.meal || null}, ${description},
            ${Math.round(calories)}, ${proteinG}, ${carbsG}, ${fatG},
            ${veggieServings}, ${fluidOz}, ${body.source},
            ${body.source_detail || null})
    RETURNING id, name, meal, description, calories, protein_g, carbs_g,
              fat_g, veggie_servings, fluid_oz, source, source_detail, created_at
  `;
  return Response.json({ favorite: shape(row) }, { status: 201 });
});
