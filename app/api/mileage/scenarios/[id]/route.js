import { getDb, dateOnly } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { legFrequencyScenarioImpacts } from '../../../../../lib/mileage';

// PATCH covers editing a scenario's fields, toggling `active`, and changing
// a leg-based scenario's frequency (recomputes impacts server-side, same
// as POST — never trusts client-sent impact numbers for a leg-based row).
export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] =
    await sql`SELECT * FROM mileage_scenarios WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const name =
    body.name !== undefined ? String(body.name).trim() : existing.name;
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const note = body.note !== undefined ? body.note || null : existing.note;
  const active = body.active !== undefined ? !!body.active : existing.active;

  const legId = existing.leg_id;
  let impact1 = existing.impact_1yr;
  let impact2 = existing.impact_2yr;
  let impact3 = existing.impact_3yr;
  let newTimesPerWeek = existing.new_times_per_week;

  if (legId && body.new_times_per_week !== undefined) {
    const timesPerWeek = Number(body.new_times_per_week);
    if (!Number.isFinite(timesPerWeek) || timesPerWeek < 0) {
      return Response.json(
        { error: 'new_times_per_week must be a non-negative number' },
        { status: 400 }
      );
    }
    const [[settings], [leg]] = await Promise.all([
      sql`SELECT lease_start_date FROM mileage_settings WHERE id = 1`,
      sql`SELECT * FROM mileage_usual_legs WHERE id = ${legId}`,
    ]);
    if (!leg || !settings?.lease_start_date) {
      return Response.json(
        {
          error:
            'could not recompute — the linked route or lease start is missing',
        },
        { status: 400 }
      );
    }
    const impacts = legFrequencyScenarioImpacts({
      leaseStart: dateOnly(settings.lease_start_date),
      leg,
      newTimesPerWeek: timesPerWeek,
    });
    newTimesPerWeek = timesPerWeek;
    impact1 = impacts.impact_1yr;
    impact2 = impacts.impact_2yr;
    impact3 = impacts.impact_3yr;
  } else if (!legId) {
    impact1 =
      body.impact_1yr !== undefined
        ? Number(body.impact_1yr) || 0
        : existing.impact_1yr;
    impact2 =
      body.impact_2yr !== undefined
        ? Number(body.impact_2yr) || 0
        : existing.impact_2yr;
    impact3 =
      body.impact_3yr !== undefined
        ? Number(body.impact_3yr) || 0
        : existing.impact_3yr;
  }

  const [row] = await sql`
    UPDATE mileage_scenarios SET
      name = ${name}, note = ${note}, active = ${active},
      impact_1yr = ${impact1}, impact_2yr = ${impact2}, impact_3yr = ${impact3},
      new_times_per_week = ${newTimesPerWeek},
      updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json({ scenario: row });
});

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM mileage_scenarios WHERE id = ${id}`;
  return Response.json({ ok: true });
});
