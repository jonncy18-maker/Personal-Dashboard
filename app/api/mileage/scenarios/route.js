import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { legFrequencyScenarioImpacts } from '../../../../lib/mileage';

// A scenario is either manual (John types impact_1yr/2yr/3yr directly) or
// leg-based ("what if the cafe trip became 3x/week instead of 2x?" —
// leg_id + new_times_per_week). For a leg-based scenario the impacts are
// always computed server-side from the leg + lease start, never trusted
// from the client, so they can't drift from lib/mileage.js's own math.
//
// Timing (migration 025): `occurrence` is 'recurring' (default) or
// 'one_time'. Recurring takes an optional `effective_start` month (null =
// since lease start, unchanged from pre-025 behavior) alongside the usual
// impact_1yr/2yr/3yr or leg_id fields. One-time takes `one_time_start` (+
// optional `one_time_end`, defaulting to the same month) and a flat
// `one_time_miles` instead — no leg_id, no yearly impacts.
export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const note = body.note || null;
  const sql = getDb();

  const occurrence = body.occurrence === 'one_time' ? 'one_time' : 'recurring';

  if (occurrence === 'one_time') {
    const oneTimeStart = body.one_time_start || null;
    if (!oneTimeStart) {
      return Response.json(
        { error: 'one_time_start is required for a one-time scenario' },
        { status: 400 }
      );
    }
    const oneTimeEnd = body.one_time_end || oneTimeStart;
    const oneTimeMiles = Number(body.one_time_miles) || 0;

    const [row] = await sql`
      INSERT INTO mileage_scenarios (
        name, note, occurrence, one_time_start, one_time_end, one_time_miles
      )
      VALUES (
        ${name}, ${note}, 'one_time', ${oneTimeStart}, ${oneTimeEnd}, ${oneTimeMiles}
      )
      RETURNING *
    `;
    return Response.json({ scenario: row }, { status: 201 });
  }

  const effectiveStart = body.effective_start || null;
  let legId = null;
  let newTimesPerWeek = null;
  let impact1;
  let impact2;
  let impact3;

  if (body.leg_id) {
    const [[settings], [leg]] = await Promise.all([
      sql`SELECT lease_start_date FROM mileage_settings WHERE id = 1`,
      sql`SELECT * FROM mileage_usual_legs WHERE id = ${body.leg_id}`,
    ]);
    if (!leg) {
      return Response.json({ error: 'route not found' }, { status: 404 });
    }
    if (!settings?.lease_start_date) {
      return Response.json(
        {
          error:
            'set your lease start date before adding a route-based scenario',
        },
        { status: 400 }
      );
    }
    const timesPerWeek = Number(body.new_times_per_week);
    if (!Number.isFinite(timesPerWeek) || timesPerWeek < 0) {
      return Response.json(
        { error: 'new_times_per_week must be a non-negative number' },
        { status: 400 }
      );
    }
    legId = leg.id;
    newTimesPerWeek = timesPerWeek;
    const impacts = legFrequencyScenarioImpacts({
      leaseStart: dateOnly(settings.lease_start_date),
      leg,
      newTimesPerWeek: timesPerWeek,
    });
    impact1 = impacts.impact_1yr;
    impact2 = impacts.impact_2yr;
    impact3 = impacts.impact_3yr;
  } else {
    impact1 = Number(body.impact_1yr) || 0;
    impact2 = Number(body.impact_2yr) || 0;
    impact3 = Number(body.impact_3yr) || 0;
  }

  const [row] = await sql`
    INSERT INTO mileage_scenarios (
      name, note, impact_1yr, impact_2yr, impact_3yr, leg_id, new_times_per_week,
      occurrence, effective_start
    )
    VALUES (
      ${name}, ${note}, ${impact1}, ${impact2}, ${impact3}, ${legId}, ${newTimesPerWeek},
      'recurring', ${effectiveStart}
    )
    RETURNING *
  `;
  return Response.json({ scenario: row }, { status: 201 });
});
