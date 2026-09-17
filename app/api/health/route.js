import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
import { computeTarget, dayTotals, todayYMD } from '../../../lib/health';

// Health › Diet — the profile plus the computed day view in one read, so the
// page never has to assemble the target from three round trips (and so the
// same numbers can never drift between them).
//
// Everything numeric is coerced with num() here at the boundary, per
// CLAUDE.md §7.8 — NUMERIC columns arrive from the Neon driver as strings and
// the arithmetic in lib/health.js would silently concatenate them.

// Wide enough to cover "year to date" and a custom range spanning a couple
// of years without another round trip; the client slices it down to
// whatever window (This Month / YTD / custom) is actually being viewed.
// Cheap for one user's dated rows either way.
const TREND_DAYS = 3650;

function shapeProfile(row) {
  if (!row) return null;
  return {
    ...row,
    birth_date: dateOnly(row.birth_date),
    goal_date: dateOnly(row.goal_date),
    height_in: num(row.height_in),
    activity_multiplier: num(row.activity_multiplier),
    activity_trailing_days: num(row.activity_trailing_days),
    goal_weight_lb: num(row.goal_weight_lb),
    floor_pct: num(row.floor_pct),
  };
}

function shapeReading(row) {
  return {
    ...row,
    reading_date: dateOnly(row.reading_date),
    weight_lb: num(row.weight_lb),
    steps: row.steps == null ? null : Number(row.steps),
  };
}

export const GET = route(async (request) => {
  const sql = getDb();
  const url = new URL(request.url);
  const todayStr = url.searchParams.get('date') || todayYMD();

  const [profileRow] = await sql`
    SELECT * FROM health_profile WHERE id = 1
  `;
  const profile = shapeProfile(profileRow);

  const [latestRow] = await sql`
    SELECT id, reading_date, weight_lb, steps, note
    FROM health_weight_readings
    WHERE reading_date <= ${todayStr} AND weight_lb IS NOT NULL
    ORDER BY reading_date DESC
    LIMIT 1
  `;
  const latestWeight = latestRow ? shapeReading(latestRow) : null;

  // The viewed day's own steps, distinct from latestWeight above: weight
  // forward-fills (the most recent reading stands in until a newer one
  // arrives, since it's the target's input), but steps are a per-day fact —
  // no reading for today does not mean "assume yesterday's step count."
  const [todayStepsRow] = await sql`
    SELECT steps FROM health_weight_readings WHERE reading_date = ${todayStr}
  `;
  const todaySteps =
    todayStepsRow?.steps == null ? null : Number(todayStepsRow.steps);

  const trendRows = await sql`
    SELECT id, reading_date, weight_lb, steps, note
    FROM health_weight_readings
    ORDER BY reading_date DESC
    LIMIT ${TREND_DAYS}
  `;
  const shapedTrend = trendRows.map(shapeReading);

  const entryRows = await sql`
    SELECT id, entry_date, meal, description, calories, source,
           source_detail, logged_via, created_at
    FROM health_intake_entries
    WHERE entry_date = ${todayStr}
    ORDER BY created_at ASC
  `;
  const entries = entryRows.map((row) => ({
    ...row,
    entry_date: dateOnly(row.entry_date),
  }));

  // shapedTrend already carries every logged {reading_date, steps} row (well
  // past any reasonable trailing window) — reused here instead of a second
  // query. computeTarget's own trailingStepsAverage does the windowing.
  const target = computeTarget({
    profile,
    latestWeight,
    todayStr,
    stepsRows: shapedTrend,
  });
  const totals = dayTotals(entries);

  // `remaining` is only meaningful next to the completeness signal the client
  // renders from `totals` — see the ROADMAP entry: a big friendly number after
  // an unlogged day is the one way this domain can lie.
  const remaining = target.target == null ? null : target.target - totals.total;

  return Response.json({
    date: todayStr,
    profile,
    target,
    totals,
    remaining,
    entries,
    latestWeight,
    todaySteps,
    trend: [...shapedTrend].reverse(),
  });
});

const PROFILE_FIELDS = [
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
];

const ACTIVITY_SOURCES = ['manual', 'steps_trailing'];

export const PATCH = route(async (request) => {
  const body = await request.json();

  const patch = {};
  for (const field of PROFILE_FIELDS) {
    if (field in body) patch[field] = body[field] === '' ? null : body[field];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'no fields to update' }, { status: 400 });
  }
  if (patch.sex != null && !['male', 'female'].includes(patch.sex)) {
    return Response.json({ error: 'invalid sex' }, { status: 400 });
  }
  // activity_source/activity_trailing_days are NOT NULL at the DB level
  // (schema default 'manual' / 14) — an empty string means "reset to that
  // default", never "clear to null", unlike every other nullable field above.
  if ('activity_source' in patch) {
    patch.activity_source = patch.activity_source || 'manual';
    if (!ACTIVITY_SOURCES.includes(patch.activity_source)) {
      return Response.json(
        { error: 'invalid activity_source' },
        { status: 400 }
      );
    }
  }
  if ('activity_trailing_days' in patch) {
    patch.activity_trailing_days = patch.activity_trailing_days || 14;
  }

  // Read-merge-write rather than ten conditional SQL fragments: a field the
  // caller omitted must keep its stored value, while a field sent as null must
  // clear it. COALESCE cannot express both, and getting it wrong silently
  // wipes the profile.
  const sql = getDb();
  const [current] = await sql`SELECT * FROM health_profile WHERE id = 1`;
  if (!current) {
    return Response.json({ error: 'profile row missing' }, { status: 404 });
  }
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
        manual_target_cal   = ${next.manual_target_cal}
    WHERE id = 1
    RETURNING *
  `;
  return Response.json({ profile: shapeProfile(row) });
});
