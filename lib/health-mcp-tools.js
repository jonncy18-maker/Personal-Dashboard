import { getDb, num, dateOnly } from './db';
import { computeTarget, dayTotals, todayYMD } from './health';
import { toolText } from './mcp-server';

// Health › Diet's MCP tools — the PRIMARY capture path (see ROADMAP.md's
// 2026-09-16 entry). Claude logs food and weight here directly against the
// database (not through the app's own /api/health routes, unlike the
// app-wide assistant catalog in lib/assistant.js) because this predates that
// catalog and writes are simple enough not to need the extra hop. Shared
// between the Health-only MCP server (app/api/mcp/health) and the app-wide
// one (app/api/mcp/app) so the tool definitions and logic exist exactly
// once.

export const HEALTH_TOOLS = [
  {
    name: 'log_food',
    description:
      "Log something John ate to the Personal Dashboard's diet tracker. " +
      'ALWAYS set `source` honestly: "label" only when the calorie figure was ' +
      'read off a nutrition panel or a posted menu, "recall" when you are ' +
      'recalling a branded item from memory rather than reading it, and ' +
      '"estimated" when you are estimating from a description or a photo. ' +
      'Never use "label" for a number you produced yourself — the app shows ' +
      'non-label totals with a tilde so John knows they contain estimates. ' +
      'protein_g/carbs_g/fat_g are optional but encouraged — protein in ' +
      'particular is the strongest signal for body composition in a deficit. ' +
      'Only omit a macro when you genuinely have no basis for it; do not ' +
      'guess a number just to fill the field.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What was eaten.' },
        calories: { type: 'integer', description: 'Calories for this entry.' },
        protein_g: { type: 'number', description: 'Grams of protein.' },
        carbs_g: { type: 'number', description: 'Grams of carbohydrate.' },
        fat_g: { type: 'number', description: 'Grams of fat.' },
        meal: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        source: { type: 'string', enum: ['label', 'recall', 'estimated'] },
        source_detail: {
          type: 'string',
          description:
            'Where a label came from (menu, wrapper, URL) or what a recall was matched against.',
        },
        entry_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
      },
      required: ['description', 'calories', 'meal', 'source'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_weight',
    description:
      'Record a weigh-in. One reading per calendar day — logging a date that ' +
      'already has a reading corrects it rather than adding a second.',
    inputSchema: {
      type: 'object',
      properties: {
        weight_lb: { type: 'number' },
        reading_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
        note: { type: 'string' },
      },
      required: ['weight_lb'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_steps',
    description:
      "Record a day's step count. One reading per calendar day — logging a " +
      'date that already has one corrects it rather than adding a second ' +
      '(the same way a re-weigh or a later sync would). Never used to ' +
      'adjust the calorie target or credit calories back — it is a ' +
      'display/log-only figure.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'integer', description: 'Non-negative step count.' },
        reading_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
      },
      required: ['steps'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_day',
    description:
      "Read a day's intake, the computed calorie target with the formula and " +
      'inputs behind it, and how complete the log is. Use this before ' +
      'answering anything about how much John has left to eat. Each entry ' +
      'includes its id, needed for update_intake_entry/delete_intake_entry.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'YYYY-MM-DD. Defaults to today.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'update_intake_entry',
    description:
      'Correct an already-logged intake entry (typo, wrong calorie figure, wrong meal). ' +
      'Only pass the fields that changed. If `calories` changes and `source` is not ' +
      'also given, an entry currently tiered "label" is automatically re-tiered to ' +
      '"estimated" — a hand-edited number is no longer a transcription of a printed ' +
      'figure, so it does not keep a badge it no longer earns. Get the id from get_day.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entry id, from get_day.' },
        description: { type: 'string' },
        calories: { type: 'integer' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        meal: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        source: { type: 'string', enum: ['label', 'recall', 'estimated'] },
        source_detail: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_intake_entry',
    description:
      'Permanently remove a logged intake entry. Destructive — only after John ' +
      'explicitly confirmed in this conversation. Get the id from get_day.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Entry id, from get_day.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_favorite_meals',
    description:
      "List John's saved favorite meals (things he eats often, like the same " +
      'breakfast every day) — a template for one-tap re-logging via ' +
      'log_favorite_meal, not a log itself.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'save_favorite_meal',
    description:
      'Save a new favorite meal template — usually from something John just ' +
      'described as "the usual" or asked to save for reuse. Not a log entry ' +
      'by itself; use log_favorite_meal to actually log it on a given day. ' +
      'Set `source` with the same honesty rule as log_food.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Short label John will recognize, e.g. "Usual breakfast".',
        },
        description: { type: 'string', description: 'What it is.' },
        calories: { type: 'integer' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
        meal: {
          type: 'string',
          description:
            'Default meal slot for this favorite, if it always goes there.',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        source: { type: 'string', enum: ['label', 'recall', 'estimated'] },
        source_detail: { type: 'string' },
      },
      required: ['name', 'description', 'calories', 'source'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_favorite_meal',
    description:
      'Log a saved favorite meal as a fresh intake entry for a given day — a ' +
      'one-tap "the usual" rather than retyping description/calories/macros ' +
      'from scratch. Get the id from list_favorite_meals. The new entry is an ' +
      'independent copy; editing or deleting it afterward never touches the ' +
      'favorite template itself.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Favorite id, from list_favorite_meals.',
        },
        meal: {
          type: 'string',
          description:
            "Overrides the favorite's default meal slot. Required if the favorite has no default.",
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        entry_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_favorite_meal',
    description:
      'Permanently remove a saved favorite meal template. Destructive — only ' +
      'after John explicitly confirmed. Does not touch any past intake entry ' +
      'logged from it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Favorite id, from list_favorite_meals.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_recommended_meals',
    description:
      'List the current "recommended meals" — Claude-curated nudges toward ' +
      'a healthier baseline, DIFFERENT from favorites (favorites are things ' +
      "John already eats; these are suggestions to try). 'today' items are " +
      "scoped to a specific date's remaining calories/macros; 'ongoing' " +
      'items are standing habit-level suggestions with no expiry.',
    inputSchema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            "Only return 'today' items for this date, plus all 'ongoing' " +
            'ones. YYYY-MM-DD, defaults to today.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'add_recommended_meal',
    description:
      'Add a new recommended meal or habit suggestion. NEVER call this ' +
      'unless John has just explicitly confirmed in this conversation that ' +
      'he wants it added (e.g. he said "push that to the app" after you ' +
      'proposed it) — this is a full-control tool, and the confirmation is ' +
      'the only safeguard against writing something he never agreed to. ' +
      'Use horizon "today" for a specific-day nudge (reacting to remaining ' +
      'calories/macros — set for_date) and "ongoing" for a standing habit ' +
      'suggestion with no expiry (do not set for_date). calories/macros are ' +
      'optional — omit them entirely for pure guidance with no specific food ' +
      'behind it (e.g. "add more fiber at breakfast").',
    inputSchema: {
      type: 'object',
      properties: {
        horizon: { type: 'string', enum: ['today', 'ongoing'] },
        for_date: {
          type: 'string',
          description:
            'Required (YYYY-MM-DD) when horizon is "today"; omit entirely for "ongoing".',
        },
        title: { type: 'string', description: 'Short label.' },
        detail: {
          type: 'string',
          description: 'The actual suggestion and reasoning behind it.',
        },
        meal: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        calories: { type: 'integer' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
      },
      required: ['horizon', 'title', 'detail'],
      additionalProperties: false,
    },
  },
  {
    name: 'update_recommended_meal',
    description:
      'Edit an existing recommended meal or habit suggestion. Same ' +
      'confirm-first rule as add_recommended_meal — never call without John ' +
      'having just agreed to the change in this conversation. Only pass the ' +
      'fields that changed. Get the id from list_recommended_meals.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Recommendation id, from list_recommended_meals.',
        },
        horizon: { type: 'string', enum: ['today', 'ongoing'] },
        for_date: { type: 'string' },
        title: { type: 'string' },
        detail: { type: 'string' },
        meal: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        calories: { type: 'integer' },
        protein_g: { type: 'number' },
        carbs_g: { type: 'number' },
        fat_g: { type: 'number' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_recommended_meal',
    description:
      'Permanently remove a recommended meal or habit suggestion. ' +
      'Destructive — only after John explicitly confirmed. Does not touch ' +
      'any past intake entry logged from it.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Recommendation id, from list_recommended_meals.',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'log_recommended_meal',
    description:
      'Turn a meal-shaped recommendation (one with a calorie figure) into a ' +
      'fresh, independent intake entry for a given day — e.g. John says ' +
      '"let\'s do that recommended lunch today." Fails if the recommendation ' +
      'has no calorie figure (a pure habit suggestion has nothing to log). ' +
      'The new entry is always tiered "estimated" (it is Claude\'s own ' +
      'number, never a transcribed label) and independent of the ' +
      'recommendation afterward. Get the id from list_recommended_meals.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Recommendation id, from list_recommended_meals.',
        },
        meal: {
          type: 'string',
          description:
            "Overrides the recommendation's default meal slot. Required if it has no default.",
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
        },
        entry_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCES = ['label', 'recall', 'estimated'];
const HORIZONS = ['today', 'ongoing'];
const HEALTH_TOOL_NAMES = new Set(HEALTH_TOOLS.map((t) => t.name));

// Each macro is optional and independent — omitted means "not given", never
// zero. `current` (an existing row, for update_intake_entry) lets an omitted
// field keep its stored value rather than being cleared.
function parseMacros(args, current = {}) {
  const out = {};
  for (const key of ['protein_g', 'carbs_g', 'fat_g']) {
    if (!(key in args)) {
      out[key] = current[key] ?? null;
      continue;
    }
    if (args[key] == null) {
      out[key] = null;
      continue;
    }
    const n = Number(args[key]);
    if (!Number.isFinite(n) || n < 0) {
      return { error: `${key} must be a non-negative number` };
    }
    out[key] = n;
  }
  return out;
}

export function isHealthTool(name) {
  return HEALTH_TOOL_NAMES.has(name);
}

async function readDay(sql, dateStr) {
  const [profileRow] = await sql`SELECT * FROM health_profile WHERE id = 1`;
  const profile = profileRow
    ? {
        ...profileRow,
        birth_date: dateOnly(profileRow.birth_date),
        goal_date: dateOnly(profileRow.goal_date),
        height_in: num(profileRow.height_in),
        activity_multiplier: num(profileRow.activity_multiplier),
        activity_trailing_days: num(profileRow.activity_trailing_days),
        goal_weight_lb: num(profileRow.goal_weight_lb),
        floor_pct: num(profileRow.floor_pct),
      }
    : null;

  const [latestRow] = await sql`
    SELECT reading_date, weight_lb FROM health_weight_readings
    WHERE reading_date <= ${dateStr} AND weight_lb IS NOT NULL
    ORDER BY reading_date DESC LIMIT 1
  `;
  const latestWeight = latestRow
    ? {
        reading_date: dateOnly(latestRow.reading_date),
        weight_lb: num(latestRow.weight_lb),
      }
    : null;

  // Steps are a per-day fact, not forward-filled like weight above — no
  // reading for this exact date means no steps are known for it, never
  // "assume the last known count."
  const [stepsRow] = await sql`
    SELECT steps FROM health_weight_readings WHERE reading_date = ${dateStr}
  `;
  const steps = stepsRow?.steps == null ? null : Number(stepsRow.steps);

  // Only actually used when activity_source = 'steps_trailing', but cheap
  // enough to fetch unconditionally rather than branch on the profile first.
  const stepsRowsRaw = await sql`
    SELECT reading_date, steps FROM health_weight_readings
    WHERE steps IS NOT NULL
    ORDER BY reading_date DESC LIMIT 60
  `;
  const stepsRows = stepsRowsRaw.map((r) => ({
    reading_date: dateOnly(r.reading_date),
    steps: num(r.steps),
  }));

  const entryRows = await sql`
    SELECT id, meal, description, calories, protein_g, carbs_g, fat_g, source
    FROM health_intake_entries
    WHERE entry_date = ${dateStr}
    ORDER BY created_at ASC
  `;
  const entries = entryRows.map((r) => ({
    ...r,
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
  }));

  const target = computeTarget({
    profile,
    latestWeight,
    todayStr: dateStr,
    stepsRows,
  });
  const totals = dayTotals(entries);

  return {
    date: dateStr,
    target: target.target,
    target_provenance: target.provenance,
    maintenance: target.maintenance,
    deficit: target.deficit,
    floor: target.floor,
    clamped: target.clamped,
    projected_goal_date: target.projectedDate,
    weight_lb: target.weightLb,
    weight_reading_date: target.weightDate,
    weight_age_days: target.weightAgeDays,
    steps,
    activity_multiplier: target.activityMultiplier,
    activity_provenance: target.activityProvenance,
    activity_label: target.activityLabel,
    activity_avg_steps: target.activityAvgSteps,
    activity_window_days: target.activityWindowDays,
    activity_days_logged: target.activityDaysLogged,
    activity_min_days_needed: target.activityMinDaysNeeded,
    missing_inputs: target.missing,
    consumed: totals.total,
    consumed_is_estimate: totals.estimated,
    remaining: target.target == null ? null : target.target - totals.total,
    meals_logged: totals.mealsLogged,
    // Each macro total only sums entries that actually logged it — `*_complete`
    // says whether every entry this day has it, so a partial sum is never
    // read as the whole day's figure.
    protein_g: totals.proteinG,
    protein_complete: totals.proteinComplete,
    carbs_g: totals.carbsG,
    carbs_complete: totals.carbsComplete,
    fat_g: totals.fatG,
    fat_complete: totals.fatComplete,
    entries,
  };
}

export async function callHealthTool(name, args) {
  const sql = getDb();

  if (name === 'get_day') {
    const dateStr = args.date || todayYMD();
    const day = await readDay(sql, dateStr);
    return toolText(JSON.stringify(day, null, 2));
  }

  if (name === 'log_food') {
    const description = String(args.description || '').trim();
    const calories = Number(args.calories);
    if (!description) return toolText('description is required', true);
    if (!MEALS.includes(args.meal)) {
      return toolText(`meal must be one of ${MEALS.join(', ')}`, true);
    }
    if (!SOURCES.includes(args.source)) {
      return toolText(
        `source must be one of ${SOURCES.join(', ')} — pick the one that ` +
          'honestly describes where the number came from',
        true
      );
    }
    if (!Number.isFinite(calories) || calories < 0) {
      return toolText('calories must be a non-negative number', true);
    }
    const macros = parseMacros(args);
    if (macros.error) return toolText(macros.error, true);
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_intake_entries
        (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
         source, source_detail, logged_via)
      VALUES (${entryDate}, ${args.meal}, ${description}, ${Math.round(calories)},
              ${macros.protein_g}, ${macros.carbs_g}, ${macros.fat_g},
              ${args.source}, ${args.source_detail || null}, 'mcp')
      RETURNING id
    `;
    const day = await readDay(sql, entryDate);
    return toolText(
      `Logged "${description}" (${Math.round(calories)} cal, ${args.source}) ` +
        `to ${args.meal} on ${entryDate}. id=${row.id}\n\n` +
        JSON.stringify(
          {
            consumed: day.consumed,
            consumed_is_estimate: day.consumed_is_estimate,
            remaining: day.remaining,
            meals_logged: day.meals_logged,
          },
          null,
          2
        )
    );
  }

  if (name === 'log_weight') {
    const weight = Number(args.weight_lb);
    if (!Number.isFinite(weight) || weight <= 0) {
      return toolText('weight_lb must be a positive number', true);
    }
    const readingDate = args.reading_date || todayYMD();
    await sql`
      INSERT INTO health_weight_readings (reading_date, weight_lb, note)
      VALUES (${readingDate}, ${weight}, ${args.note || null})
      ON CONFLICT (reading_date) DO UPDATE
        SET weight_lb = EXCLUDED.weight_lb, note = EXCLUDED.note
    `;
    const day = await readDay(sql, readingDate);
    return toolText(
      `Recorded ${weight} lb on ${readingDate}. ` +
        `Daily target is now ${day.target ?? '—'} cal` +
        (day.clamped
          ? ` (clamped at the safe floor — the goal now tracks to ${day.projected_goal_date}).`
          : '.')
    );
  }

  if (name === 'log_steps') {
    const steps = Math.round(Number(args.steps));
    if (!Number.isFinite(steps) || steps < 0) {
      return toolText('steps must be a non-negative number', true);
    }
    const readingDate = args.reading_date || todayYMD();
    // Read-merge-write, not a bare upsert: a plain INSERT ... ON CONFLICT
    // DO UPDATE SET steps=... is safe for steps itself (it never touches
    // weight_lb), but going through the same shape as
    // app/api/health/weight keeps the two write paths from drifting.
    const [current] = await sql`
      SELECT weight_lb, note FROM health_weight_readings
      WHERE reading_date = ${readingDate}
    `;
    await sql`
      INSERT INTO health_weight_readings (reading_date, weight_lb, steps, note)
      VALUES (${readingDate}, ${current?.weight_lb ?? null}, ${steps}, ${current?.note ?? null})
      ON CONFLICT (reading_date) DO UPDATE SET steps = ${steps}
    `;
    return toolText(`Recorded ${steps} steps on ${readingDate}.`);
  }

  if (name === 'update_intake_entry') {
    if (!args.id) return toolText('id is required', true);
    const [current] = await sql`
      SELECT * FROM health_intake_entries WHERE id = ${args.id}
    `;
    if (!current) return toolText(`no entry with id ${args.id}`, true);

    if (args.meal != null && !MEALS.includes(args.meal)) {
      return toolText(`meal must be one of ${MEALS.join(', ')}`, true);
    }
    if (args.source != null && !SOURCES.includes(args.source)) {
      return toolText(`source must be one of ${SOURCES.join(', ')}`, true);
    }

    let calories = current.calories;
    if (args.calories != null) {
      const parsed = Number(args.calories);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return toolText('calories must be a non-negative number', true);
      }
      calories = Math.round(parsed);
    }

    // Same rule as app/api/health/intake/[id] (the UI's own edit path): a
    // calorie change with no explicit new source re-tiers a 'label' row down
    // to 'estimated', since a hand-edited number is no longer a
    // transcription of a printed figure.
    const caloriesChanged = calories !== current.calories;
    const source =
      args.source ??
      (caloriesChanged && current.source === 'label'
        ? 'estimated'
        : current.source);

    const macros = parseMacros(args, current);
    if (macros.error) return toolText(macros.error, true);

    const [row] = await sql`
      UPDATE health_intake_entries
      SET meal          = ${args.meal ?? current.meal},
          description   = ${(args.description ?? current.description).trim()},
          calories      = ${calories},
          protein_g     = ${macros.protein_g},
          carbs_g       = ${macros.carbs_g},
          fat_g         = ${macros.fat_g},
          source        = ${source},
          source_detail = ${args.source_detail ?? current.source_detail}
      WHERE id = ${args.id}
      RETURNING entry_date, meal, description, calories, source
    `;
    const day = await readDay(sql, dateOnly(row.entry_date));
    return toolText(
      `Updated "${row.description}" (${row.calories} cal, ${row.source}) ` +
        `on ${dateOnly(row.entry_date)}.` +
        (source !== current.source
          ? ` Re-tiered from ${current.source} to ${source}.`
          : '') +
        `\n\n${JSON.stringify(
          {
            consumed: day.consumed,
            consumed_is_estimate: day.consumed_is_estimate,
            remaining: day.remaining,
          },
          null,
          2
        )}`
    );
  }

  if (name === 'delete_intake_entry') {
    if (!args.id) return toolText('id is required', true);
    const [row] = await sql`
      DELETE FROM health_intake_entries WHERE id = ${args.id}
      RETURNING entry_date, description
    `;
    if (!row) return toolText(`no entry with id ${args.id}`, true);
    return toolText(
      `Deleted "${row.description}" from ${dateOnly(row.entry_date)}.`
    );
  }

  if (name === 'list_favorite_meals') {
    const rows = await sql`
      SELECT id, name, meal, description, calories, protein_g, carbs_g,
             fat_g, source, source_detail
      FROM health_favorite_meals
      ORDER BY created_at ASC
    `;
    const favorites = rows.map((r) => ({
      ...r,
      protein_g: num(r.protein_g),
      carbs_g: num(r.carbs_g),
      fat_g: num(r.fat_g),
    }));
    return toolText(JSON.stringify(favorites, null, 2));
  }

  if (name === 'save_favorite_meal') {
    const favName = String(args.name || '').trim();
    const description = String(args.description || '').trim();
    const calories = Number(args.calories);
    if (!favName) return toolText('name is required', true);
    if (!description) return toolText('description is required', true);
    if (args.meal != null && !MEALS.includes(args.meal)) {
      return toolText(`meal must be one of ${MEALS.join(', ')}`, true);
    }
    if (!SOURCES.includes(args.source)) {
      return toolText(`source must be one of ${SOURCES.join(', ')}`, true);
    }
    if (!Number.isFinite(calories) || calories < 0) {
      return toolText('calories must be a non-negative number', true);
    }
    const macros = parseMacros(args);
    if (macros.error) return toolText(macros.error, true);

    const [row] = await sql`
      INSERT INTO health_favorite_meals
        (name, meal, description, calories, protein_g, carbs_g, fat_g,
         source, source_detail)
      VALUES (${favName}, ${args.meal || null}, ${description},
              ${Math.round(calories)}, ${macros.protein_g}, ${macros.carbs_g},
              ${macros.fat_g}, ${args.source}, ${args.source_detail || null})
      RETURNING id
    `;
    return toolText(`Saved favorite "${favName}". id=${row.id}`);
  }

  if (name === 'log_favorite_meal') {
    if (!args.id) return toolText('id is required', true);
    const [favorite] = await sql`
      SELECT * FROM health_favorite_meals WHERE id = ${args.id}
    `;
    if (!favorite) return toolText(`no favorite with id ${args.id}`, true);

    const meal = args.meal || favorite.meal;
    if (!MEALS.includes(meal)) {
      return toolText(
        'this favorite has no default meal — pass one explicitly',
        true
      );
    }
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_intake_entries
        (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
         source, source_detail, logged_via)
      VALUES (${entryDate}, ${meal}, ${favorite.description}, ${favorite.calories},
              ${favorite.protein_g}, ${favorite.carbs_g}, ${favorite.fat_g},
              ${favorite.source}, ${favorite.source_detail}, 'mcp')
      RETURNING id
    `;
    const day = await readDay(sql, entryDate);
    return toolText(
      `Logged "${favorite.description}" (${favorite.calories} cal, ` +
        `${favorite.source}) to ${meal} on ${entryDate} from favorite ` +
        `"${favorite.name}". id=${row.id}\n\n` +
        JSON.stringify(
          {
            consumed: day.consumed,
            consumed_is_estimate: day.consumed_is_estimate,
            remaining: day.remaining,
            meals_logged: day.meals_logged,
          },
          null,
          2
        )
    );
  }

  if (name === 'delete_favorite_meal') {
    if (!args.id) return toolText('id is required', true);
    const [row] = await sql`
      DELETE FROM health_favorite_meals WHERE id = ${args.id}
      RETURNING name
    `;
    if (!row) return toolText(`no favorite with id ${args.id}`, true);
    return toolText(`Deleted favorite "${row.name}".`);
  }

  if (name === 'list_recommended_meals') {
    const dateStr = args.date || todayYMD();
    const rows = await sql`
      SELECT id, horizon, for_date, title, detail, meal, calories, protein_g,
             carbs_g, fat_g, created_at
      FROM health_recommended_meals
      WHERE horizon = 'ongoing' OR for_date = ${dateStr}
      ORDER BY horizon ASC, created_at DESC
    `;
    const recs = rows.map((r) => ({
      ...r,
      for_date: dateOnly(r.for_date),
      protein_g: num(r.protein_g),
      carbs_g: num(r.carbs_g),
      fat_g: num(r.fat_g),
    }));
    return toolText(JSON.stringify(recs, null, 2));
  }

  if (name === 'add_recommended_meal') {
    const title = String(args.title || '').trim();
    const detail = String(args.detail || '').trim();
    if (!title) return toolText('title is required', true);
    if (!detail) return toolText('detail is required', true);
    if (!HORIZONS.includes(args.horizon)) {
      return toolText(`horizon must be one of ${HORIZONS.join(', ')}`, true);
    }
    if (args.meal != null && !MEALS.includes(args.meal)) {
      return toolText(`meal must be one of ${MEALS.join(', ')}`, true);
    }
    const forDate =
      args.horizon === 'today' ? args.for_date || todayYMD() : null;
    if (args.horizon === 'today' && !forDate) {
      return toolText('for_date is required when horizon is "today"', true);
    }
    const macros = parseMacros(args);
    if (macros.error) return toolText(macros.error, true);
    let calories = null;
    if (args.calories != null) {
      calories = Number(args.calories);
      if (!Number.isFinite(calories) || calories < 0) {
        return toolText('calories must be a non-negative number', true);
      }
      calories = Math.round(calories);
    }

    const [row] = await sql`
      INSERT INTO health_recommended_meals
        (horizon, for_date, title, detail, meal, calories, protein_g, carbs_g, fat_g)
      VALUES (${args.horizon}, ${forDate}, ${title}, ${detail},
              ${args.meal || null}, ${calories}, ${macros.protein_g},
              ${macros.carbs_g}, ${macros.fat_g})
      RETURNING id
    `;
    return toolText(
      `Added ${args.horizon} recommendation "${title}". id=${row.id}`
    );
  }

  if (name === 'update_recommended_meal') {
    if (!args.id) return toolText('id is required', true);
    const [current] = await sql`
      SELECT * FROM health_recommended_meals WHERE id = ${args.id}
    `;
    if (!current) return toolText(`no recommendation with id ${args.id}`, true);

    if (args.horizon != null && !HORIZONS.includes(args.horizon)) {
      return toolText(`horizon must be one of ${HORIZONS.join(', ')}`, true);
    }
    if (args.meal != null && !MEALS.includes(args.meal)) {
      return toolText(`meal must be one of ${MEALS.join(', ')}`, true);
    }

    const horizon = args.horizon ?? current.horizon;
    let forDate;
    if ('for_date' in args || 'horizon' in args) {
      forDate =
        horizon === 'today'
          ? args.for_date || dateOnly(current.for_date) || todayYMD()
          : null;
    } else {
      forDate = dateOnly(current.for_date);
    }

    const macros = parseMacros(args, current);
    if (macros.error) return toolText(macros.error, true);
    let calories = current.calories;
    if ('calories' in args) {
      if (args.calories == null) {
        calories = null;
      } else {
        const parsed = Number(args.calories);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return toolText('calories must be a non-negative number', true);
        }
        calories = Math.round(parsed);
      }
    }

    const title = String(args.title ?? current.title).trim();
    const detail = String(args.detail ?? current.detail).trim();
    if (!title) return toolText('title is required', true);
    if (!detail) return toolText('detail is required', true);

    const [row] = await sql`
      UPDATE health_recommended_meals
      SET horizon    = ${horizon},
          for_date   = ${forDate},
          title      = ${title},
          detail     = ${detail},
          meal       = ${args.meal ?? current.meal},
          calories   = ${calories},
          protein_g  = ${macros.protein_g},
          carbs_g    = ${macros.carbs_g},
          fat_g      = ${macros.fat_g}
      WHERE id = ${args.id}
      RETURNING title
    `;
    return toolText(`Updated recommendation "${row.title}".`);
  }

  if (name === 'delete_recommended_meal') {
    if (!args.id) return toolText('id is required', true);
    const [row] = await sql`
      DELETE FROM health_recommended_meals WHERE id = ${args.id}
      RETURNING title
    `;
    if (!row) return toolText(`no recommendation with id ${args.id}`, true);
    return toolText(`Deleted recommendation "${row.title}".`);
  }

  if (name === 'log_recommended_meal') {
    if (!args.id) return toolText('id is required', true);
    const [rec] = await sql`
      SELECT * FROM health_recommended_meals WHERE id = ${args.id}
    `;
    if (!rec) return toolText(`no recommendation with id ${args.id}`, true);
    if (rec.calories == null) {
      return toolText(
        'this recommendation has no calorie figure to log — it is a pure habit suggestion',
        true
      );
    }

    const meal = args.meal || rec.meal;
    if (!MEALS.includes(meal)) {
      return toolText(
        'this recommendation has no default meal — pass one explicitly',
        true
      );
    }
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_intake_entries
        (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
         source, source_detail, logged_via)
      VALUES (${entryDate}, ${meal}, ${rec.title}, ${rec.calories},
              ${rec.protein_g}, ${rec.carbs_g}, ${rec.fat_g}, 'estimated',
              ${'from recommended meal: ' + rec.title}, 'mcp')
      RETURNING id
    `;
    const day = await readDay(sql, entryDate);
    return toolText(
      `Logged "${rec.title}" (${rec.calories} cal, estimated) to ${meal} ` +
        `on ${entryDate} from recommendation. id=${row.id}\n\n` +
        JSON.stringify(
          {
            consumed: day.consumed,
            consumed_is_estimate: day.consumed_is_estimate,
            remaining: day.remaining,
            meals_logged: day.meals_logged,
          },
          null,
          2
        )
    );
  }

  return toolText(`unknown tool: ${name}`, true);
}
