import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { todayYMD, parseVeggieServings } from '../../../../lib/health';

// Intake entries. `source` is required and never defaulted: it is the whole
// honesty mechanism (see the ROADMAP entry and .claude/skills/health), and a
// silent default would quietly upgrade a guess to a transcribed label.

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCES = ['label', 'recall', 'estimated'];
const LOGGED_VIA = ['app', 'mcp'];

function shape(row) {
  return {
    ...row,
    entry_date: dateOnly(row.entry_date),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    veggie_servings: num(row.veggie_servings),
  };
}

// A macro field is optional at every boundary (unlike calories) — omitted or
// blank means "not logged", never zero. Returns undefined for "not passed at
// all" vs null for "explicitly cleared", and throws a plain string for the
// route to turn into a 400 when a value was given but isn't a valid number.
function parseMacro(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error('invalid');
  return n;
}

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const sql = getDb();

  const rows = date
    ? await sql`
        SELECT id, entry_date, meal, description, calories, protein_g,
               carbs_g, fat_g, veggie_servings, source, source_detail, logged_via,
               created_at,
               updated_at
        FROM health_intake_entries
        WHERE entry_date = ${date}
        ORDER BY created_at ASC
      `
    : await sql`
        SELECT id, entry_date, meal, description, calories, protein_g,
               carbs_g, fat_g, veggie_servings, source, source_detail, logged_via,
               created_at,
               updated_at
        FROM health_intake_entries
        ORDER BY entry_date DESC, created_at ASC
        LIMIT 500
      `;

  return Response.json({ entries: rows.map(shape) });
});

export const POST = route(async (request) => {
  const body = await request.json();

  const description = (body.description || '').trim();
  if (!description) {
    return Response.json({ error: 'description is required' }, { status: 400 });
  }
  if (!MEALS.includes(body.meal)) {
    return Response.json(
      { error: `meal must be one of ${MEALS.join(', ')}` },
      { status: 400 }
    );
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

  const entryDate = body.entry_date || todayYMD();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return Response.json(
      { error: 'entry_date must be YYYY-MM-DD' },
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

  const loggedVia = LOGGED_VIA.includes(body.logged_via)
    ? body.logged_via
    : 'app';

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO health_intake_entries
      (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
       veggie_servings, source, source_detail, logged_via)
    VALUES (${entryDate}, ${body.meal}, ${description}, ${Math.round(calories)},
            ${proteinG}, ${carbsG}, ${fatG}, ${veggieServings},
            ${body.source}, ${body.source_detail || null}, ${loggedVia})
    RETURNING id, entry_date, meal, description, calories, protein_g, carbs_g,
              fat_g, veggie_servings, source, source_detail, logged_via,
              created_at, updated_at
  `;
  return Response.json({ entry: shape(row) }, { status: 201 });
});
