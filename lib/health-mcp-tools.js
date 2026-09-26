import { getDb, num, dateOnly } from './db';
import {
  computeTarget,
  dayTotals,
  veggieProgress,
  parseFluidOz,
  toWaterOunces,
  waterProgress,
  WATER_UNITS,
  todayYMD,
  addDays,
  daysBetween,
} from './health';
import { toolText } from './mcp-server';

// Health › Diet's MCP tools — the PRIMARY capture path (see ROADMAP.md's
// 2026-09-16 entry). Claude logs food and weight here directly against the
// database (not through the app's own /api/health routes, unlike the
// app-wide assistant catalog in lib/assistant.js) because this predates that
// catalog and writes are simple enough not to need the extra hop. Shared
// between the Health-only MCP server (app/api/mcp/health) and the app-wide
// one (app/api/mcp/app) so the tool definitions and logic exist exactly
// once.

// Shared wording so every tool that takes veggie_servings defines a serving
// the same way (USDA cup-equivalents, halved for cooked).
const VEGGIE_SERVING_DESC =
  'Vegetable servings in this entry — 1 serving ≈ 1 cup raw or 1/2 cup ' +
  'cooked vegetables (USDA guidance). Fractions are fine (0.5). Defaults to ' +
  '0, so set it whenever the food contains a meaningful amount of ' +
  'vegetables; a garnish is 0.';

// Shared wording for the drink-fluid field on food entries and favorites.
const FLUID_OZ_DESC =
  'Only for a drink logged as food (protein shake, latte, juice, smoothie): ' +
  'the liquid it is made with, in US fl oz — e.g. a shake made with 12 oz ' +
  'of milk or water → 12. Counted in full toward the day’s water, shown ' +
  'separately from plain water. Powders and solids do not count; omit for ' +
  'food and for alcohol. Convert cups (8 oz) or ml yourself.';

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
      'guess a number just to fill the field. veggie_servings is optional ' +
      'and defaults to 0 — set it whenever the meal contains vegetables, or ' +
      "the day's vegetable baseline under-counts. If the item is a drink " +
      '(e.g. a protein shake), set fluid_oz to the liquid it is made with so ' +
      'it counts toward water.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What was eaten.' },
        calories: { type: 'integer', description: 'Calories for this entry.' },
        protein_g: { type: 'number', description: 'Grams of protein.' },
        carbs_g: { type: 'number', description: 'Grams of carbohydrate.' },
        fat_g: { type: 'number', description: 'Grams of fat.' },
        veggie_servings: {
          type: 'number',
          description: VEGGIE_SERVING_DESC,
        },
        fluid_oz: { type: 'number', description: FLUID_OZ_DESC },
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
    name: 'log_water',
    description:
      'Record one drink of water. Log each drink as it happens ("I just ' +
      'drank an 8 oz cup" → amount 8, unit "oz"); the day total is the sum, ' +
      'so never pass a running total. A "cup" is the 8 fl oz US cup. Water ' +
      'is kept separate from food and never counts as a meal logged.',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'How much was drunk.' },
        unit: {
          type: 'string',
          enum: WATER_UNITS,
          description: 'oz (US fl oz, default), cup (8 oz), or ml.',
        },
        entry_date: {
          type: 'string',
          description: "YYYY-MM-DD. Defaults to today on the server's clock.",
        },
      },
      required: ['amount'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_water_entry',
    description:
      'Remove one logged drink (e.g. logged twice by mistake). Destructive — ' +
      'only after John explicitly confirmed in this conversation. Get the id ' +
      "from get_day's water_entries.",
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Water entry id, from get_day.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_day',
    annotations: { readOnlyHint: true },
    description:
      "Read a day's intake, the computed calorie target with the formula and " +
      'inputs behind it, and how complete the log is. Use this before ' +
      'answering anything about how much John has left to eat. Also reports ' +
      "the day's vegetable servings against the profile baseline " +
      '(veggie_servings_total / veggie_target_servings / veggie_target_met) ' +
      'and water (water_oz_total = plain water_plain_oz + water_from_drinks_oz ' +
      'from drinks logged as food, water_cups_total, water_entries, and ' +
      'water_target_met — null when no water goal is set). ' +
      'Each entry includes its id, needed for ' +
      'update_intake_entry/delete_intake_entry.',
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
        veggie_servings: {
          type: 'number',
          description: VEGGIE_SERVING_DESC,
        },
        fluid_oz: { type: 'number', description: FLUID_OZ_DESC },
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
    annotations: { readOnlyHint: true },
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
        veggie_servings: {
          type: 'number',
          description: VEGGIE_SERVING_DESC,
        },
        fluid_oz: { type: 'number', description: FLUID_OZ_DESC },
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
    annotations: { readOnlyHint: true },
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
  {
    name: 'get_health_profile',
    annotations: { readOnlyHint: true },
    description:
      'Read the Mifflin–St Jeor profile inputs behind the daily calorie ' +
      'target: sex, birth date/age, height, activity settings, goal weight/ ' +
      'date, the safe floor, and any manual overrides. Use before ' +
      'update_health_profile so an edit only changes the fields intended.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'update_health_profile',
    description:
      "Update John's Health profile — the inputs the Mifflin–St Jeor target " +
      'is computed from. Only pass fields that changed; an omitted field ' +
      'keeps its stored value, an explicit null clears it (except ' +
      'activity_source/activity_trailing_days, which reset to their default ' +
      "'manual'/14 instead of going null, since those columns are never " +
      'nullable). manual_target_cal, if set, overrides the formula entirely ' +
      'and stops it computing — same for manual_floor_cal against the safe ' +
      'floor. Ethnicity is never a field here (not a valid input to any ' +
      'standard energy equation) — refuse if asked to add it.',
    inputSchema: {
      type: 'object',
      properties: {
        sex: { type: 'string', enum: ['male', 'female'] },
        birth_date: { type: 'string', description: 'YYYY-MM-DD' },
        age_years: {
          type: 'number',
          description: 'Only if birth_date is unknown — birth_date wins.',
        },
        height_in: { type: 'number' },
        activity_multiplier: {
          type: 'number',
          description:
            'The manual multiplier — also the fallback value while activity_source is steps_trailing but not enough data has been logged yet.',
        },
        activity_source: { type: 'string', enum: ['manual', 'steps_trailing'] },
        activity_trailing_days: {
          type: 'integer',
          description:
            'Window size for the steps_trailing average. Default 14.',
        },
        goal_weight_lb: { type: 'number' },
        goal_date: { type: 'string', description: 'YYYY-MM-DD' },
        floor_pct: {
          type: 'number',
          description:
            'Fraction of maintenance the target may not go below, e.g. 0.8.',
        },
        manual_floor_cal: {
          type: 'integer',
          description: 'Flat floor override in calories, instead of floor_pct.',
        },
        manual_target_cal: {
          type: 'integer',
          description:
            'Overrides the formula entirely — a doctor-given number.',
        },
        veggie_target_servings: {
          type: 'number',
          description:
            'Daily vegetable-servings baseline get_day checks against. Default 2.',
        },
        water_target_oz: {
          type: 'number',
          description:
            'Optional daily water goal in US fl oz. Unset by default — only set it to a number John gives; null clears it.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_trailing_net_calories',
    annotations: { readOnlyHint: true },
    description:
      'Trailing net calorie surplus/deficit — sum of (consumed - target) ' +
      'over a window, so a running trend is visible instead of just today. ' +
      'A day with nothing logged is excluded entirely, never counted as a ' +
      'full deficit. daysLogged vs daysInRange shows how partial the picture ' +
      'is — a 2-of-30-day figure is not a confident month total.',
    inputSchema: {
      type: 'object',
      properties: {
        range: {
          type: 'string',
          enum: ['week', 'month', 'ytd'],
          description:
            'week/month are trailing windows (last 7/30 days including today); ytd is calendar-year-to-date. Defaults to week.',
        },
      },
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

// veggie_servings is NOT NULL DEFAULT 0 (migration 035): omitted on a new row
// means 0, omitted on an update keeps the stored value, null resets to 0.
function parseVeggies(args, current) {
  if (!('veggie_servings' in args)) {
    return { value: current == null ? 0 : num(current.veggie_servings) };
  }
  if (args.veggie_servings == null) return { value: 0 };
  const n = Number(args.veggie_servings);
  if (!Number.isFinite(n) || n < 0 || n > 999) {
    return { error: 'veggie_servings must be a non-negative number' };
  }
  return { value: Math.round(n * 10) / 10 };
}

// fluid_oz is nullable (migration 037): omitted on a new row → null (not a
// drink), omitted on an update keeps the stored value, null clears it.
function parseFluid(args, current) {
  if (!('fluid_oz' in args)) {
    return { value: current == null ? null : num(current.fluid_oz) };
  }
  const v = parseFluidOz(args.fluid_oz);
  if (v === undefined) return { error: 'fluid_oz must be a positive number' };
  return { value: v };
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
        veggie_target_servings: num(profileRow.veggie_target_servings),
        water_target_oz: num(profileRow.water_target_oz),
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
    SELECT id, meal, description, calories, protein_g, carbs_g, fat_g,
           veggie_servings, fluid_oz, source
    FROM health_intake_entries
    WHERE entry_date = ${dateStr}
    ORDER BY created_at ASC
  `;
  const entries = entryRows.map((r) => ({
    ...r,
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    veggie_servings: num(r.veggie_servings),
    fluid_oz: num(r.fluid_oz),
  }));

  const target = computeTarget({
    profile,
    latestWeight,
    todayStr: dateStr,
    stepsRows,
  });
  const totals = dayTotals(entries);
  const waterRows = await sql`
    SELECT id, ounces, logged_via, created_at FROM health_water_entries
    WHERE entry_date = ${dateStr}
    ORDER BY created_at ASC
  `;
  const waterEntries = waterRows.map((r) => ({ ...r, ounces: num(r.ounces) }));
  const water = waterProgress(
    waterEntries,
    profile?.water_target_oz ?? null,
    entries
  );
  const veggies = veggieProgress(
    totals.veggieServings,
    profile?.veggie_target_servings ?? null
  );

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
    // Servings default to 0 per entry, so this sum can only under-count —
    // read it next to meals_logged: "not met" on an unlogged day means
    // "not logged", not a verdict.
    veggie_servings_total: veggies.servings,
    veggie_target_servings: veggies.target,
    veggie_target_met: veggies.met,
    // Water is its own log (never a meal). No goal set → met is null, not a
    // verdict against a number John never chose.
    // Drink fluid is counted in full but kept visible as its own figure.
    water_oz_total: water.ounces,
    water_plain_oz: water.plainOunces,
    water_from_drinks_oz: water.fromDrinksOunces,
    water_cups_total: water.cups,
    water_target_oz: water.target,
    water_target_met: water.met,
    water_entries: waterEntries,
    entries,
  };
}

export async function callHealthTool(name, args) {
  const sql = getDb();

  if (name === 'log_water') {
    const unit = args.unit || 'oz';
    const ounces = toWaterOunces(args.amount, unit);
    if (ounces == null) {
      return toolText(
        `amount must be a positive number and unit one of ${WATER_UNITS.join(', ')}`,
        true
      );
    }
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_water_entries (entry_date, ounces, logged_via)
      VALUES (${entryDate}, ${ounces}, 'mcp')
      RETURNING id
    `;
    const day = await readDay(sql, entryDate);
    return toolText(
      `Logged ${ounces} oz of water on ${entryDate}. id=${row.id}\n\n` +
        JSON.stringify(
          {
            water_oz_total: day.water_oz_total,
            water_cups_total: day.water_cups_total,
            water_target_oz: day.water_target_oz,
            water_target_met: day.water_target_met,
          },
          null,
          2
        )
    );
  }

  if (name === 'delete_water_entry') {
    if (!args.id) return toolText('id is required', true);
    const [row] = await sql`
      DELETE FROM health_water_entries WHERE id = ${args.id}
      RETURNING entry_date, ounces
    `;
    if (!row) return toolText(`no water entry with id ${args.id}`, true);
    return toolText(
      `Deleted ${num(row.ounces)} oz of water from ${dateOnly(row.entry_date)}.`
    );
  }

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
    const veggies = parseVeggies(args);
    if (veggies.error) return toolText(veggies.error, true);
    const fluid = parseFluid(args);
    if (fluid.error) return toolText(fluid.error, true);
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_intake_entries
        (entry_date, meal, description, calories, protein_g, carbs_g, fat_g,
         veggie_servings, fluid_oz, source, source_detail, logged_via)
      VALUES (${entryDate}, ${args.meal}, ${description}, ${Math.round(calories)},
              ${macros.protein_g}, ${macros.carbs_g}, ${macros.fat_g},
              ${veggies.value}, ${fluid.value}, ${args.source},
              ${args.source_detail || null}, 'mcp')
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
            veggie_servings_total: day.veggie_servings_total,
            veggie_target_met: day.veggie_target_met,
            water_oz_total: day.water_oz_total,
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
    const veggies = parseVeggies(args, current);
    if (veggies.error) return toolText(veggies.error, true);
    const fluid = parseFluid(args, current);
    if (fluid.error) return toolText(fluid.error, true);

    const [row] = await sql`
      UPDATE health_intake_entries
      SET meal          = ${args.meal ?? current.meal},
          description   = ${(args.description ?? current.description).trim()},
          calories      = ${calories},
          protein_g     = ${macros.protein_g},
          carbs_g       = ${macros.carbs_g},
          fat_g         = ${macros.fat_g},
          veggie_servings = ${veggies.value},
          fluid_oz      = ${fluid.value},
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
             fat_g, veggie_servings, fluid_oz, source, source_detail
      FROM health_favorite_meals
      ORDER BY created_at ASC
    `;
    const favorites = rows.map((r) => ({
      ...r,
      protein_g: num(r.protein_g),
      carbs_g: num(r.carbs_g),
      fat_g: num(r.fat_g),
      veggie_servings: num(r.veggie_servings),
      fluid_oz: num(r.fluid_oz),
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
    const veggies = parseVeggies(args);
    if (veggies.error) return toolText(veggies.error, true);
    const fluid = parseFluid(args);
    if (fluid.error) return toolText(fluid.error, true);

    const [row] = await sql`
      INSERT INTO health_favorite_meals
        (name, meal, description, calories, protein_g, carbs_g, fat_g,
         veggie_servings, fluid_oz, source, source_detail)
      VALUES (${favName}, ${args.meal || null}, ${description},
              ${Math.round(calories)}, ${macros.protein_g}, ${macros.carbs_g},
              ${macros.fat_g}, ${veggies.value}, ${fluid.value}, ${args.source},
              ${args.source_detail || null})
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
         veggie_servings, fluid_oz, source, source_detail, logged_via)
      VALUES (${entryDate}, ${meal}, ${favorite.description}, ${favorite.calories},
              ${favorite.protein_g}, ${favorite.carbs_g}, ${favorite.fat_g},
              ${favorite.veggie_servings}, ${favorite.fluid_oz}, ${favorite.source},
              ${favorite.source_detail}, 'mcp')
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
            veggie_servings_total: day.veggie_servings_total,
            veggie_target_met: day.veggie_target_met,
            water_oz_total: day.water_oz_total,
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
            veggie_servings_total: day.veggie_servings_total,
            veggie_target_met: day.veggie_target_met,
            water_oz_total: day.water_oz_total,
          },
          null,
          2
        )
    );
  }

  if (name === 'get_health_profile') {
    const [row] = await sql`SELECT * FROM health_profile WHERE id = 1`;
    if (!row) return toolText('no profile row exists yet', true);
    return toolText(
      JSON.stringify(
        {
          ...row,
          birth_date: dateOnly(row.birth_date),
          goal_date: dateOnly(row.goal_date),
          height_in: num(row.height_in),
          activity_multiplier: num(row.activity_multiplier),
          activity_trailing_days: num(row.activity_trailing_days),
          goal_weight_lb: num(row.goal_weight_lb),
          floor_pct: num(row.floor_pct),
          veggie_target_servings: num(row.veggie_target_servings),
          water_target_oz: num(row.water_target_oz),
        },
        null,
        2
      )
    );
  }

  if (name === 'update_health_profile') {
    const fields = [
      'sex',
      'birth_date',
      'age_years',
      'height_in',
      'activity_multiplier',
      'activity_source',
      'activity_trailing_days',
      'goal_weight_lb',
      'goal_date',
      'floor_pct',
      'manual_floor_cal',
      'manual_target_cal',
      'veggie_target_servings',
      'water_target_oz',
    ];
    const patch = {};
    for (const field of fields) {
      if (field in args) patch[field] = args[field] === '' ? null : args[field];
    }
    if (Object.keys(patch).length === 0) {
      return toolText('no fields to update', true);
    }
    if (patch.sex != null && !['male', 'female'].includes(patch.sex)) {
      return toolText('sex must be "male" or "female"', true);
    }
    if ('activity_source' in patch) {
      patch.activity_source = patch.activity_source || 'manual';
      if (!['manual', 'steps_trailing'].includes(patch.activity_source)) {
        return toolText(
          'activity_source must be "manual" or "steps_trailing"',
          true
        );
      }
    }
    if ('activity_trailing_days' in patch) {
      patch.activity_trailing_days = patch.activity_trailing_days || 14;
    }
    // NOT NULL column: null/'' resets to the default 2, like the two above.
    if ('veggie_target_servings' in patch) {
      const n = Number(patch.veggie_target_servings ?? 2);
      if (!Number.isFinite(n) || n <= 0 || n > 99) {
        return toolText(
          'veggie_target_servings must be a positive number',
          true
        );
      }
      patch.veggie_target_servings = n;
    }
    // Nullable: null/'' clears the goal (no verdict shown), unlike the
    // NOT NULL targets above.
    if (patch.water_target_oz != null) {
      const n = Number(patch.water_target_oz);
      if (!Number.isFinite(n) || n <= 0 || n > 999) {
        return toolText('water_target_oz must be a positive number', true);
      }
      patch.water_target_oz = n;
    }

    const [current] = await sql`SELECT * FROM health_profile WHERE id = 1`;
    if (!current) return toolText('no profile row exists yet', true);
    const next = { ...current, ...patch };

    const [row] = await sql`
      UPDATE health_profile
      SET sex                 = ${next.sex},
          birth_date          = ${dateOnly(next.birth_date)},
          age_years           = ${next.age_years},
          height_in           = ${next.height_in},
          activity_multiplier = ${next.activity_multiplier},
          activity_source     = ${next.activity_source},
          activity_trailing_days = ${next.activity_trailing_days},
          goal_weight_lb      = ${next.goal_weight_lb},
          goal_date           = ${dateOnly(next.goal_date)},
          floor_pct           = ${next.floor_pct},
          manual_floor_cal    = ${next.manual_floor_cal},
          manual_target_cal   = ${next.manual_target_cal},
          veggie_target_servings = ${next.veggie_target_servings},
          water_target_oz     = ${next.water_target_oz}
      WHERE id = 1
      RETURNING *
    `;
    const day = await readDay(sql, todayYMD());
    return toolText(
      `Updated Health profile.\n\n${JSON.stringify(
        {
          profile: {
            ...row,
            birth_date: dateOnly(row.birth_date),
            goal_date: dateOnly(row.goal_date),
          },
          today_target: day.target,
          today_target_provenance: day.target_provenance,
        },
        null,
        2
      )}`
    );
  }

  if (name === 'get_trailing_net_calories') {
    const RANGE_DAYS = { week: 7, month: 30 };
    const range = ['week', 'month', 'ytd'].includes(args.range)
      ? args.range
      : 'week';
    const todayStr = todayYMD();
    const from =
      range === 'ytd'
        ? `${todayStr.slice(0, 4)}-01-01`
        : addDays(todayStr, -((RANGE_DAYS[range] || RANGE_DAYS.week) - 1));

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

    const weightRowsRaw = await sql`
      SELECT reading_date, weight_lb, steps
      FROM health_weight_readings
      ORDER BY reading_date ASC
    `;
    const weightRows = weightRowsRaw.map((row) => ({
      reading_date: dateOnly(row.reading_date),
      weight_lb: num(row.weight_lb),
      steps: row.steps == null ? null : Number(row.steps),
    }));
    function latestWeightAsOf(dateStr) {
      let found = null;
      for (const row of weightRows) {
        if (row.weight_lb == null || row.reading_date > dateStr) continue;
        found = row;
      }
      return found;
    }

    const dayRows = await sql`
      SELECT entry_date, SUM(calories)::int AS total,
             bool_or(source <> 'label') AS estimated
      FROM health_intake_entries
      WHERE entry_date >= ${from} AND entry_date <= ${todayStr}
      GROUP BY entry_date
      ORDER BY entry_date
    `;

    let net = 0;
    let daysLogged = 0;
    let estimated = false;
    for (const row of dayRows) {
      const dateStr = dateOnly(row.entry_date);
      const target = computeTarget({
        profile,
        latestWeight: latestWeightAsOf(dateStr),
        todayStr: dateStr,
        stepsRows: weightRows,
      });
      if (target.target == null) continue;
      net += Number(row.total) - target.target;
      daysLogged += 1;
      if (row.estimated) estimated = true;
    }

    return toolText(
      JSON.stringify(
        {
          range,
          from,
          to: todayStr,
          net: daysLogged > 0 ? Math.round(net) : null,
          daysLogged,
          daysInRange: daysBetween(from, todayStr) + 1,
          estimated,
        },
        null,
        2
      )
    );
  }

  return toolText(`unknown tool: ${name}`, true);
}
