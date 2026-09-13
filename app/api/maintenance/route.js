import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
import { monthlyForecast } from '../../../lib/mileage';
import { maintenanceSummary } from '../../../lib/maintenance';

// Maintenance's one-round-trip read: the schedule, every item's service
// history, and each item's computed due state.
//
// The due math needs the SAME forecast the Mileage tab draws, so this route
// loads the mileage inputs and calls monthlyForecast() rather than deriving
// a second pace. That is what keeps the two tabs from ever disagreeing about
// how fast the car is being driven.

export async function loadMaintenance(sql) {
  const [
    [settings],
    itemRows,
    recordRows,
    readingRows,
    scenarioRows,
    exclusionRows,
  ] = await Promise.all([
    sql`SELECT * FROM mileage_settings WHERE id = 1`,
    sql`SELECT * FROM maintenance_items ORDER BY sort_order ASC, created_at ASC`,
    sql`SELECT * FROM maintenance_records ORDER BY service_date ASC`,
    sql`SELECT id, reading_date, odometer FROM mileage_readings ORDER BY reading_date ASC`,
    sql`SELECT * FROM mileage_scenarios`,
    sql`SELECT * FROM mileage_travel_exclusions`,
  ]);

  const normalizedSettings = settings
    ? { ...settings, lease_start_date: dateOnly(settings.lease_start_date) }
    : null;

  const readings = readingRows.map((r) => ({
    ...r,
    reading_date: dateOnly(r.reading_date),
  }));

  const exclusions = exclusionRows.map((e) => ({
    ...e,
    start_date: dateOnly(e.start_date),
    end_date: dateOnly(e.end_date),
    daily_rate_used: num(e.daily_rate_used),
    miles_excluded: num(e.miles_excluded),
  }));

  const records = recordRows.map((r) => ({
    ...r,
    service_date: dateOnly(r.service_date),
  }));

  const recordsByItem = {};
  for (const record of records) {
    (recordsByItem[record.item_id] ||= []).push(record);
  }

  const forecast = monthlyForecast({
    settings: normalizedSettings,
    readings,
    scenarios: scenarioRows,
    exclusions,
  });

  return {
    settings: normalizedSettings,
    items: itemRows,
    records,
    recordsByItem,
    readings,
    forecast,
  };
}

export const GET = route(async () => {
  const sql = getDb();
  const { settings, items, recordsByItem, readings, forecast } =
    await loadMaintenance(sql);

  const rows = maintenanceSummary({
    items,
    recordsByItem,
    forecast,
    settings,
  });

  const latestReading = readings[readings.length - 1] || null;

  return Response.json({
    settings,
    rows,
    recordsByItem,
    // The check-off form prefills from this — a real logged number, never a
    // projection. Sent with its date so the UI can say how current it is.
    latestReading,
  });
});

function validateIntervals(body) {
  const miles =
    body.interval_miles === null || body.interval_miles === undefined
      ? null
      : Number(body.interval_miles);
  const months =
    body.interval_months === null || body.interval_months === undefined
      ? null
      : Number(body.interval_months);

  if (miles !== null && (!Number.isFinite(miles) || miles <= 0)) {
    return { error: 'interval_miles must be a positive number or null' };
  }
  if (months !== null && (!Number.isFinite(months) || months <= 0)) {
    return { error: 'interval_months must be a positive number or null' };
  }
  return { miles, months };
}

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();

  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }

  const intervals = validateIntervals(body);
  if (intervals.error) {
    return Response.json({ error: intervals.error }, { status: 400 });
  }

  // A hand-added item with no interval at all has nothing to compute a due
  // date from. Items sourced from a manufacturer may legitimately have none
  // (the Model 3 brake fluid check states no interval), so that case is
  // allowed only through the seed route, never through manual entry.
  if (intervals.miles === null && intervals.months === null) {
    return Response.json(
      { error: 'set a mileage interval, a time interval, or both' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO maintenance_items
      (name, interval_miles, interval_months, condition_note, active, source)
    VALUES (
      ${name},
      ${intervals.miles},
      ${intervals.months},
      ${body.condition_note?.trim() || null},
      ${body.active === undefined ? true : !!body.active},
      'manual'
    )
    RETURNING *
  `;
  return Response.json({ item: row }, { status: 201 });
});
