import { getDb, num, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import {
  mileageSummary,
  tripDayCount,
  travelExclusionMiles,
} from '../../../../lib/mileage';

// Travel Day Exclusions — reviewed like Travel's Gmail trip-suggestion
// queue (accept/dismiss), but modeling a real one-time fact ("I wasn't
// home driving these days"), not a hypothetical recurring routine change
// like a Forecast Scenario. Accepting snapshots the CURRENTLY active
// baseline daily rate (logged pace, or the usual-trips rate if that's
// active) x the trip's day count, so the exclusion never silently drifts
// if the pace changes later — same discipline as a leg-based scenario's
// impact being computed once at save time.

async function currentBaselinePace(sql) {
  const [[settings], readingRows] = await Promise.all([
    sql`SELECT * FROM mileage_settings WHERE id = 1`,
    sql`SELECT id, reading_date, odometer FROM mileage_readings ORDER BY reading_date ASC`,
  ]);
  if (!settings) return null;
  const summary = mileageSummary({
    settings: {
      ...settings,
      lease_start_date: dateOnly(settings.lease_start_date),
    },
    readings: readingRows.map((r) => ({
      ...r,
      reading_date: dateOnly(r.reading_date),
    })),
    scenarios: [],
    exclusions: [],
  });
  return summary.configured ? summary.baselinePace : null;
}

export const POST = route(async (request) => {
  const body = await request.json();
  const sql = getDb();

  if (body.trip_id) {
    const [trip] = await sql`
      SELECT id, destination, start_date, end_date FROM trips WHERE id = ${body.trip_id}
    `;
    if (!trip || !trip.start_date || !trip.end_date) {
      return Response.json(
        { error: 'trip not found or missing dates' },
        { status: 404 }
      );
    }
    const startDate = dateOnly(trip.start_date);
    const endDate = dateOnly(trip.end_date);
    const days = tripDayCount(startDate, endDate);
    const dismissing = body.status === 'dismissed';

    let dailyRate = null;
    let milesExcluded = null;
    if (!dismissing) {
      dailyRate = await currentBaselinePace(sql);
      milesExcluded = travelExclusionMiles({ dailyRate, days });
    }

    const [row] = await sql`
      INSERT INTO mileage_travel_exclusions (
        trip_id, label, start_date, end_date, days,
        daily_rate_used, miles_excluded, status, source
      ) VALUES (
        ${trip.id}, ${trip.destination}, ${startDate}, ${endDate}, ${days},
        ${dailyRate}, ${milesExcluded}, ${dismissing ? 'dismissed' : 'accepted'}, 'travel'
      )
      RETURNING *
    `;
    return Response.json(
      {
        exclusion: {
          ...row,
          start_date: dateOnly(row.start_date),
          end_date: dateOnly(row.end_date),
          daily_rate_used: num(row.daily_rate_used),
          miles_excluded: num(row.miles_excluded),
        },
      },
      { status: 201 }
    );
  }

  // Manual entry — a trip Travel doesn't track. Always saved as accepted;
  // there's nothing to "dismiss" for something John typed in on purpose.
  const label = (body.label || '').trim();
  const startDate = body.start_date;
  const endDate = body.end_date;
  if (
    !label ||
    !/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')
  ) {
    return Response.json(
      { error: 'label, start_date, and end_date (YYYY-MM-DD) are required' },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return Response.json(
      { error: 'end_date must be on or after start_date' },
      { status: 400 }
    );
  }
  const days = tripDayCount(startDate, endDate);
  const dailyRate = await currentBaselinePace(sql);
  const milesExcluded = travelExclusionMiles({ dailyRate, days });

  const [row] = await sql`
    INSERT INTO mileage_travel_exclusions (
      trip_id, label, start_date, end_date, days,
      daily_rate_used, miles_excluded, status, source
    ) VALUES (
      NULL, ${label}, ${startDate}, ${endDate}, ${days},
      ${dailyRate}, ${milesExcluded}, 'accepted', 'manual'
    )
    RETURNING *
  `;
  return Response.json(
    {
      exclusion: {
        ...row,
        start_date: dateOnly(row.start_date),
        end_date: dateOnly(row.end_date),
        daily_rate_used: num(row.daily_rate_used),
        miles_excluded: num(row.miles_excluded),
      },
    },
    { status: 201 }
  );
});
