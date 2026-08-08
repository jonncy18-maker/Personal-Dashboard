import { getDb, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
import {
  yearOf,
  parseYearParam,
  ptoSummary,
  holidaySetForYear,
  clampToYear,
  weekdaysExcludingHolidays,
} from '../../../lib/pto';

// PTO Planner's one-round-trip read (CLAUDE.md §7 — user-input CRUD shape,
// route()-wrapped). Everything the panel needs — real ledger, banked ledger,
// per-trip breakdown, dated-wishlist sim rows, holidays, entries, scenarios —
// comes back together so the client never has to stitch multiple fetches.
// `today` is the server clock, same "toISOString().slice(0,10)" convention
// already used by lib/schedule-import.js.

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function loadAll(sql) {
  const [[settings], holidayRows, entryRows, tripRows, scenarioRows] =
    await Promise.all([
      sql`SELECT annual_budget FROM pto_settings WHERE id = 1`,
      sql`SELECT id, holiday_date, name, worked FROM pto_holidays ORDER BY holiday_date ASC`,
      sql`SELECT id, entry_date, kind, note FROM pto_entries ORDER BY entry_date ASC`,
      sql`
        SELECT id, destination, start_date, end_date, status,
               pto_days_override, pto_exempt
        FROM trips
        ORDER BY start_date IS NULL, start_date ASC
      `,
      sql`SELECT id, name, items, created_at, updated_at FROM pto_scenarios ORDER BY created_at ASC`,
    ]);

  return {
    budget: settings?.annual_budget ?? 25,
    holidays: holidayRows.map((h) => ({
      ...h,
      holiday_date: dateOnly(h.holiday_date),
    })),
    entries: entryRows.map((e) => ({
      ...e,
      entry_date: dateOnly(e.entry_date),
    })),
    trips: tripRows.map((t) => ({
      ...t,
      start_date: dateOnly(t.start_date),
      end_date: dateOnly(t.end_date),
    })),
    scenarios: scenarioRows,
  };
}

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const today = todayStr();
  const currentYear = yearOf(today);
  const year = parseYearParam(url.searchParams.get('year'), currentYear);
  if (year == null) {
    return Response.json(
      { error: `year must be between ${currentYear} and ${currentYear + 2}` },
      { status: 400 }
    );
  }

  const sql = getDb();
  const { budget, holidays, entries, trips, scenarios } = await loadAll(sql);

  const summary = ptoSummary({
    trips,
    entries,
    holidays,
    budget,
    year,
    todayStr: today,
  });

  const holidaySet = holidaySetForYear(holidays, year);
  const wishlist = trips
    .filter((t) => t.status === 'wishlist')
    .map((t) => {
      const clamped = clampToYear(t.start_date, t.end_date, year);
      const simDays = clamped
        ? weekdaysExcludingHolidays(clamped.start, clamped.end, holidaySet)
            .length
        : null;
      return {
        id: t.id,
        destination: t.destination,
        start_date: t.start_date,
        end_date: t.end_date,
        simDays,
      };
    });

  return Response.json({
    year,
    currentYear,
    today,
    budget: summary.budget,
    taken: summary.taken,
    planned: summary.planned,
    left: summary.left,
    holidaysEntered: summary.holidaysEntered,
    banked: summary.banked,
    trips: summary.trips,
    wishlist,
    holidays,
    entries,
    scenarios,
  });
});

export const PATCH = route(async (request) => {
  const body = await request.json();
  const budget = Number(body.annual_budget);
  if (!Number.isInteger(budget) || budget < 0) {
    return Response.json(
      { error: 'annual_budget must be a non-negative integer' },
      { status: 400 }
    );
  }
  const sql = getDb();
  await sql`
    UPDATE pto_settings SET annual_budget = ${budget}, updated_at = now()
    WHERE id = 1
  `;
  return Response.json({ annual_budget: budget });
});
