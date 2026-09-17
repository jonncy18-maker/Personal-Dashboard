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
      'non-label totals with a tilde so John knows they contain estimates.',
    inputSchema: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'What was eaten.' },
        calories: { type: 'integer', description: 'Calories for this entry.' },
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
    name: 'get_day',
    description:
      "Read a day's intake, the computed calorie target with the formula and " +
      'inputs behind it, and how complete the log is. Use this before ' +
      'answering anything about how much John has left to eat.',
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
];

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const SOURCES = ['label', 'recall', 'estimated'];
const HEALTH_TOOL_NAMES = new Set(HEALTH_TOOLS.map((t) => t.name));

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
        goal_weight_lb: num(profileRow.goal_weight_lb),
        floor_pct: num(profileRow.floor_pct),
      }
    : null;

  const [latestRow] = await sql`
    SELECT reading_date, weight_lb FROM health_weight_readings
    WHERE reading_date <= ${dateStr}
    ORDER BY reading_date DESC LIMIT 1
  `;
  const latestWeight = latestRow
    ? {
        reading_date: dateOnly(latestRow.reading_date),
        weight_lb: num(latestRow.weight_lb),
      }
    : null;

  const entries = await sql`
    SELECT meal, description, calories, source
    FROM health_intake_entries
    WHERE entry_date = ${dateStr}
    ORDER BY created_at ASC
  `;

  const target = computeTarget({ profile, latestWeight, todayStr: dateStr });
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
    missing_inputs: target.missing,
    consumed: totals.total,
    consumed_is_estimate: totals.estimated,
    remaining: target.target == null ? null : target.target - totals.total,
    meals_logged: totals.mealsLogged,
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
    const entryDate = args.entry_date || todayYMD();
    const [row] = await sql`
      INSERT INTO health_intake_entries
        (entry_date, meal, description, calories, source, source_detail, logged_via)
      VALUES (${entryDate}, ${args.meal}, ${description}, ${Math.round(calories)},
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

  return toolText(`unknown tool: ${name}`, true);
}
