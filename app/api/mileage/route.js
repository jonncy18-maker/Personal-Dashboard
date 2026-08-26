import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
import { mileageSummary } from '../../../lib/mileage';

// Mileage's one-round-trip read (same shape as /api/pto): settings, the
// odometer log, the trip journal, saved scenarios, and the computed
// pace/checkpoint forecast all come back together.

async function loadAll(sql) {
  const [
    [settings],
    readingRows,
    tripRows,
    scenarioRows,
    usualLegRows,
    placeRows,
  ] = await Promise.all([
    sql`SELECT * FROM mileage_settings WHERE id = 1`,
    sql`SELECT id, reading_date, odometer FROM mileage_readings ORDER BY reading_date ASC`,
    sql`SELECT * FROM mileage_trips ORDER BY trip_date DESC NULLS LAST, created_at DESC`,
    sql`SELECT * FROM mileage_scenarios ORDER BY created_at ASC`,
    sql`SELECT * FROM mileage_usual_legs ORDER BY created_at ASC`,
    sql`SELECT * FROM mileage_places ORDER BY label ASC`,
  ]);

  return {
    settings: settings
      ? { ...settings, lease_start_date: dateOnly(settings.lease_start_date) }
      : null,
    readings: readingRows.map((r) => ({
      ...r,
      reading_date: dateOnly(r.reading_date),
    })),
    trips: tripRows.map((t) => ({
      ...t,
      trip_date: dateOnly(t.trip_date),
      origin_lat: num(t.origin_lat),
      origin_lng: num(t.origin_lng),
      destination_lat: num(t.destination_lat),
      destination_lng: num(t.destination_lng),
      miles: num(t.miles),
    })),
    scenarios: scenarioRows,
    usualLegs: usualLegRows.map((l) => ({
      ...l,
      miles: num(l.miles),
      times_per_week: num(l.times_per_week),
    })),
    places: placeRows.map((p) => ({
      ...p,
      lat: num(p.lat),
      lng: num(p.lng),
    })),
  };
}

export const GET = route(async () => {
  const sql = getDb();
  const { settings, readings, trips, scenarios, usualLegs, places } =
    await loadAll(sql);
  const summary = mileageSummary({ settings, readings, scenarios });

  return Response.json({
    settings,
    readings,
    trips,
    scenarios,
    usualLegs,
    places,
    ...summary,
  });
});

const NUMERIC_FIELDS = [
  'lease_term_months',
  'annual_allowance_miles',
  'overage_rate_cents',
  'starting_odometer',
  'usual_miles',
];
const USUAL_PERIODS = ['day', 'week', 'month'];

export const PATCH = route(async (request) => {
  const body = await request.json();
  const updates = {};

  if ('lease_start_date' in body) {
    if (
      body.lease_start_date !== null &&
      !/^\d{4}-\d{2}-\d{2}$/.test(body.lease_start_date)
    ) {
      return Response.json(
        { error: 'lease_start_date must be YYYY-MM-DD or null' },
        { status: 400 }
      );
    }
    updates.lease_start_date = body.lease_start_date;
  }
  for (const field of NUMERIC_FIELDS) {
    if (field in body) {
      const value = body[field] === null ? null : Number(body[field]);
      if (value !== null && !Number.isFinite(value)) {
        return Response.json(
          { error: `${field} must be a number or null` },
          { status: 400 }
        );
      }
      updates[field] = value;
    }
  }
  if ('usual_period' in body) {
    if (!USUAL_PERIODS.includes(body.usual_period)) {
      return Response.json(
        { error: 'usual_period must be day, week, or month' },
        { status: 400 }
      );
    }
    updates.usual_period = body.usual_period;
  }
  if ('usual_active' in body) {
    updates.usual_active = !!body.usual_active;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: 'no valid fields to update' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    UPDATE mileage_settings SET
      lease_start_date = COALESCE(${updates.lease_start_date ?? null}::date, lease_start_date),
      lease_term_months = COALESCE(${updates.lease_term_months ?? null}, lease_term_months),
      annual_allowance_miles = COALESCE(${updates.annual_allowance_miles ?? null}, annual_allowance_miles),
      overage_rate_cents = COALESCE(${updates.overage_rate_cents ?? null}, overage_rate_cents),
      starting_odometer = COALESCE(${updates.starting_odometer ?? null}, starting_odometer),
      usual_miles = COALESCE(${updates.usual_miles ?? null}, usual_miles),
      usual_period = COALESCE(${updates.usual_period ?? null}, usual_period),
      usual_active = COALESCE(${updates.usual_active ?? null}, usual_active),
      updated_at = now()
    WHERE id = 1
    RETURNING *
  `;
  return Response.json({
    settings: { ...row, lease_start_date: dateOnly(row.lease_start_date) },
  });
});
