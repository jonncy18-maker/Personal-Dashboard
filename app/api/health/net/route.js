import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import {
  computeTarget,
  todayYMD,
  addDays,
  daysBetween,
} from '../../../../lib/health';

// Trailing net calorie surplus/deficit — sum of (consumed - target) over a
// window, so John can see whether he's running ahead of or behind his target
// across a week/month/year, not just today. A day with nothing logged is
// excluded entirely rather than counted as a full deficit: "didn't log" and
// "ate nothing" are not the same claim, and this domain never conflates them
// (see dayTotals()'s own completeness signal for the single-day version of
// the same rule). `daysLogged` vs the window's real day count is how the
// client shows that this may be a partial picture.

const RANGE_DAYS = { week: 7, month: 30 };

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

// Weight forward-fills to whatever day is being scored, same rule the main
// health GET uses for "today" — a doctor's-visit weigh-in from three weeks
// ago is still the best known weight for a day in between two readings.
function latestWeightAsOf(dateStr, weightRows) {
  let found = null;
  for (const row of weightRows) {
    if (row.weight_lb == null || row.reading_date > dateStr) continue;
    found = row;
  }
  return found;
}

export const GET = route(async (request) => {
  const sql = getDb();
  const url = new URL(request.url);
  const todayStr = todayYMD();
  const range = url.searchParams.get('range');

  const from =
    range === 'ytd'
      ? `${todayStr.slice(0, 4)}-01-01`
      : addDays(todayStr, -((RANGE_DAYS[range] || RANGE_DAYS.week) - 1));

  const [profileRow] = await sql`SELECT * FROM health_profile WHERE id = 1`;
  const profile = shapeProfile(profileRow);

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
    const latestWeight = latestWeightAsOf(dateStr, weightRows);
    const target = computeTarget({
      profile,
      latestWeight,
      todayStr: dateStr,
      stepsRows: weightRows,
    });
    // No computable target that day (missing body stats, no weight yet) —
    // skip it rather than pretending a target existed. Never fabricate.
    if (target.target == null) continue;
    net += Number(row.total) - target.target;
    daysLogged += 1;
    if (row.estimated) estimated = true;
  }

  return Response.json({
    range: range === 'ytd' ? 'ytd' : RANGE_DAYS[range] ? range : 'week',
    from,
    to: todayStr,
    net: daysLogged > 0 ? Math.round(net) : null,
    daysLogged,
    daysInRange: daysBetween(from, todayStr) + 1,
    estimated,
  });
});
