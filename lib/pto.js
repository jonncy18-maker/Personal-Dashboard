import { parseDateInput } from './format';

// PTO Planner — pure date math, no DB access, no server-only imports (see
// PTO_BUILD_PLAN.md §3). Every function takes plain rows/strings + a `today`
// / `year` in and returns plain data, so the exact same functions run both
// server-side (the /api/pto routes) and client-side (the sandbox calculator
// and scenario costs in components/PtoPanel.jsx) — the math is never
// duplicated. Dates are always bare 'YYYY-MM-DD' strings; ISO date-only
// strings compare correctly with plain `<`/`<=` (see lib/db.js's dateOnly()
// and the 2026-07-15 UTC off-by-one fix in ROADMAP.md — don't reintroduce
// that bug class by routing these through `new Date(str)` for comparisons).

const YEARS_AHEAD = 2; // current year + this many, per the year switcher

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nextDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function yearBounds(year) {
  return { yearStart: `${year}-01-01`, yearEnd: `${year}-12-31` };
}

// Today's calendar year, as the default PTO year (server clock for API
// routes, the browser's clock for the sandbox calculator).
export function yearOf(todayStr) {
  return Number(todayStr.slice(0, 4));
}

// The switcher covers the current year plus the next two (John plans up to
// two years out). Returns null for anything outside that window so the
// caller can reject it (e.g. the `?year=` query param) rather than silently
// clamping.
export function parseYearParam(raw, currentYear) {
  if (raw == null || raw === '') return currentYear;
  const year = Number(raw);
  if (!Number.isInteger(year)) return null;
  if (year < currentYear || year > currentYear + YEARS_AHEAD) return null;
  return year;
}

export function yearOptions(currentYear) {
  return Array.from({ length: YEARS_AHEAD + 1 }, (_, i) => currentYear + i);
}

// Weekdays (Mon–Fri) in [startStr, endStr] inclusive, excluding any date
// present in `holidaySet`. Returns the list of counted 'YYYY-MM-DD' dates
// (not just a count) so callers can split taken vs planned per day.
export function weekdaysExcludingHolidays(startStr, endStr, holidaySet) {
  if (!startStr || !endStr || startStr > endStr) return [];
  const days = [];
  const end = parseDateInput(endStr);
  let cursor = parseDateInput(startStr);
  while (cursor <= end) {
    const dow = cursor.getDay(); // 0 = Sunday, 6 = Saturday
    const ymd = toYMD(cursor);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(ymd)) days.push(ymd);
    cursor = nextDay(cursor);
  }
  return days;
}

// Clips [startStr, endStr] to `year`'s Jan 1–Dec 31 window (handles a trip
// spanning Dec→Jan). Returns null when there is no overlap.
export function clampToYear(startStr, endStr, year) {
  if (!startStr || !endStr) return null;
  const { yearStart, yearEnd } = yearBounds(year);
  const start = startStr > yearStart ? startStr : yearStart;
  const end = endStr < yearEnd ? endStr : yearEnd;
  if (start > end) return null;
  return { start, end };
}

// The set of holiday dates ('YYYY-MM-DD') that fall inside `year`.
export function holidaySetForYear(holidays, year) {
  const { yearStart, yearEnd } = yearBounds(year);
  return new Set(
    (holidays || [])
      .filter((h) => h.holiday_date >= yearStart && h.holiday_date <= yearEnd)
      .map((h) => h.holiday_date)
  );
}

// A trip's auto PTO day count for `year`: weekdays in its range (clamped to
// the year) minus firm holidays, split taken (date <= today) vs planned
// (date > today). Callers filter to status upcoming/past first — wishlist
// trips never count toward the real balance.
export function tripAutoDays(trip, year, holidaySet, todayStr) {
  const clamped = clampToYear(trip.start_date, trip.end_date, year);
  if (!clamped) return { autoDays: 0, taken: 0, planned: 0, dates: [] };
  const dates = weekdaysExcludingHolidays(
    clamped.start,
    clamped.end,
    holidaySet
  );
  const taken = dates.filter((d) => d <= todayStr).length;
  return {
    autoDays: dates.length,
    taken,
    planned: dates.length - taken,
    dates,
  };
}

// Applies pto_exempt / pto_days_override on top of the auto count.
// pto_exempt wins outright (0 days). An override wins over the auto count
// but is classified whole — all taken or all planned, keyed off the trip's
// end_date vs today — an accepted simplification (per-day split only exists
// for the auto count). The auto number is always returned alongside so the
// UI can show "auto would be N" next to an override.
export function tripCountedDays(trip, year, holidaySet, todayStr) {
  const auto = tripAutoDays(trip, year, holidaySet, todayStr);
  if (trip.pto_exempt) {
    return { ...auto, counted: 0, countedTaken: 0, countedPlanned: 0 };
  }
  if (trip.pto_days_override != null) {
    const isTaken = trip.end_date != null && trip.end_date < todayStr;
    return {
      ...auto,
      counted: trip.pto_days_override,
      countedTaken: isTaken ? trip.pto_days_override : 0,
      countedPlanned: isTaken ? 0 : trip.pto_days_override,
    };
  }
  return {
    ...auto,
    counted: auto.autoDays,
    countedTaken: auto.taken,
    countedPlanned: auto.planned,
  };
}

// Manual 'pto' entries (never 'banked_spend') within `year`, one day each,
// split taken vs planned by date.
export function manualPtoDays(entries, year, todayStr) {
  const { yearStart, yearEnd } = yearBounds(year);
  const inYear = (entries || []).filter(
    (e) =>
      e.kind === 'pto' && e.entry_date >= yearStart && e.entry_date <= yearEnd
  );
  const taken = inYear.filter((e) => e.entry_date <= todayStr).length;
  return { count: inYear.length, taken, planned: inYear.length - taken };
}

// Banked-holiday ledger for `year` — fully separate from the PTO number.
// earned = holidays worked; spent = banked_spend entries; available = the
// difference (never negative in practice — the API refuses a spend that
// would push it below zero).
export function bankedLedger(holidays, entries, year) {
  const { yearStart, yearEnd } = yearBounds(year);
  const earned = (holidays || []).filter(
    (h) => h.worked && h.holiday_date >= yearStart && h.holiday_date <= yearEnd
  ).length;
  const spent = (entries || []).filter(
    (e) =>
      e.kind === 'banked_spend' &&
      e.entry_date >= yearStart &&
      e.entry_date <= yearEnd
  ).length;
  return { earned, spent, available: earned - spent };
}

// Full real-ledger view for `year`: per-trip breakdown, taken/planned/left,
// and the banked ledger. `left` may go negative — never clamped, shown
// honestly. `holidaysEntered` lets the UI say "no <year> holidays entered
// yet" instead of pretending an unentered year's count is final.
export function ptoSummary({
  trips,
  entries,
  holidays,
  budget,
  year,
  todayStr,
}) {
  const holidaySet = holidaySetForYear(holidays, year);
  const counted = (trips || [])
    .filter((t) => t.status === 'upcoming' || t.status === 'past')
    .map((t) => ({
      trip: t,
      ...tripCountedDays(t, year, holidaySet, todayStr),
    }));

  const tripTaken = counted.reduce((sum, t) => sum + t.countedTaken, 0);
  const tripPlanned = counted.reduce((sum, t) => sum + t.countedPlanned, 0);
  const manual = manualPtoDays(entries, year, todayStr);

  const taken = tripTaken + manual.taken;
  const planned = tripPlanned + manual.planned;

  return {
    year,
    budget,
    taken,
    planned,
    left: budget - taken - planned,
    holidaysEntered: holidaySet.size > 0,
    trips: counted.map(({ trip, autoDays, counted: c }) => ({
      id: trip.id,
      destination: trip.destination,
      start_date: trip.start_date,
      end_date: trip.end_date,
      status: trip.status,
      autoDays,
      override: trip.pto_days_override ?? null,
      exempt: !!trip.pto_exempt,
      counted: c,
    })),
    banked: bankedLedger(holidays, entries, year),
  };
}

// ─── simulation layer — read-only arithmetic on top, never blended in ──────

// Cost of one scenario item (or a sandbox-calculator range) within `year`.
// An undated wishlist trip is reported as not simulable, never guessed.
export function scenarioItemCost(item, { trips, year, holidaySet }) {
  if (item.kind === 'wishlist_trip') {
    const trip = (trips || []).find((t) => t.id === item.trip_id);
    if (!trip)
      return { simulable: false, days: null, reason: 'trip not found' };
    if (!trip.start_date || !trip.end_date) {
      return { simulable: false, days: null, reason: 'not dated yet' };
    }
    return rangeCost(trip.start_date, trip.end_date, year, holidaySet);
  }
  if (item.kind === 'range') {
    if (!item.start_date || !item.end_date) {
      return { simulable: false, days: null, reason: 'range needs both dates' };
    }
    return rangeCost(item.start_date, item.end_date, year, holidaySet);
  }
  return { simulable: false, days: null, reason: 'unknown item kind' };
}

function rangeCost(startStr, endStr, year, holidaySet) {
  const clamped = clampToYear(startStr, endStr, year);
  if (!clamped) return { simulable: true, days: 0 };
  return {
    simulable: true,
    days: weekdaysExcludingHolidays(clamped.start, clamped.end, holidaySet)
      .length,
  };
}

// Costs every item in a scenario (or an ad-hoc list) against `year`. Items
// that aren't simulable contribute 0 to `total` but are flagged individually
// — the UI shows them as "not simulable", never silently drops them.
export function scenarioTotalCost(items, { trips, year, holidaySet }) {
  const costed = (items || []).map((item) => ({
    item,
    ...scenarioItemCost(item, { trips, year, holidaySet }),
  }));
  const total = costed.reduce((sum, c) => sum + (c.simulable ? c.days : 0), 0);
  return {
    items: costed,
    total,
    allSimulable: costed.every((c) => c.simulable),
  };
}

// Simulated results are always derived as left − cost, labeled "would leave
// X" — never written back into taken/planned/left.
export function wouldLeave(left, cost) {
  return left - cost;
}
