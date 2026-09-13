import { parseDateInput } from './format';

// Car maintenance — pure math, no DB access, no server-only imports (same
// shape as lib/mileage.js and lib/pto.js, so the same functions run both
// server-side (/api/maintenance, /api/home-summary) and client-side
// (app/car/maintenance/page.jsx) and can never disagree). Dates in/out are
// bare 'YYYY-MM-DD' strings.
//
// This module deliberately does NOT compute a driving pace. Every
// miles-based due date is read off the points lib/mileage.js already
// produces, so scenarios, travel exclusions and the "usual trips" baseline
// flow into maintenance for free and the two tabs stay consistent.

const DAY_MS = 24 * 60 * 60 * 1000;

// A service is "due soon" inside either window. Sixty days because these
// intervals are long — a year, two years, ~10 months of driving for a tyre
// rotation — so a 30-day warning left almost no time to book anything. Five
// hundred miles is roughly the same notice on the mileage side (~4 weeks at
// a typical pace) and about 8% of a 6,250 mi interval.
export const SOON_DAYS = 60;
export const SOON_MILES = 500;

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

// The most recent completed service for an item, by service_date. Records
// are appended per check-off and never overwritten, so "last done" is just
// the latest row — which is why rolling an item forward to its next period
// needs no extra state stored on the item itself.
export function latestRecord(records) {
  const sorted = [...(records || [])].sort((a, b) =>
    a.service_date < b.service_date
      ? -1
      : a.service_date > b.service_date
        ? 1
        : 0
  );
  return sorted[sorted.length - 1] || null;
}

// Where an item's current period starts: its last service, or — for
// something never logged — the start of the lease. A never-serviced item is
// flagged so the UI can say so rather than implying a real service happened
// at lease start.
export function periodAnchor({ item, records, settings }) {
  const last = latestRecord(records);
  if (last) {
    return {
      date: last.service_date,
      odometer: last.odometer ?? null,
      fromService: true,
    };
  }
  if (!settings?.lease_start_date) return null;
  return {
    date: settings.lease_start_date,
    odometer: settings.starting_odometer ?? null,
    fromService: false,
  };
}

// Invert the mileage forecast: given a target odometer, when do we reach it?
// Walks the monthly points lib/mileage.js already computed and interpolates
// the crossing — never a second pace calculation.
//
// The forecast stops at the 3-year checkpoint (lease end). A target beyond
// the last point is reported as beyondHorizon rather than extrapolated into
// a date past the lease, which would be a number with nothing behind it.
export function dateAtOdometer(forecast, targetOdometer) {
  const points = (forecast || []).filter((p) => p.projectedMiles != null);
  if (points.length === 0 || targetOdometer == null) return null;

  if (targetOdometer <= points[0].projectedMiles) {
    return { date: points[0].date, beyondHorizon: false, alreadyPassed: true };
  }

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (targetOdometer > curr.projectedMiles) continue;

    const span = curr.projectedMiles - prev.projectedMiles;
    const start = parseDateInput(prev.date);
    if (span <= 0) return { date: curr.date, beyondHorizon: false };

    const fraction = (targetOdometer - prev.projectedMiles) / span;
    const daySpan = daysBetween(start, parseDateInput(curr.date));
    const hit = new Date(start.getTime());
    hit.setDate(hit.getDate() + Math.round(fraction * daySpan));
    return { date: toYMD(hit), beyondHorizon: false };
  }

  return { date: null, beyondHorizon: true };
}

// One item's due state. Returns `status: 'unknown'` with a `reason` whenever
// the inputs can't honestly produce a date — no lease configured, no
// odometer readings logged yet, or an item whose source states no interval
// at all (the Model 3 manual's brake fluid check is exactly this). None of
// those fall back to a guessed interval or a zero pace.
export function itemDueState({ item, records, forecast, settings, today }) {
  const todayStr = today || toYMD(new Date());
  const anchor = periodAnchor({ item, records, settings });

  const hasMiles = item.interval_miles != null && item.interval_miles > 0;
  const hasMonths = item.interval_months != null && item.interval_months > 0;

  const base = {
    lastService: latestRecord(records),
    anchor,
    milesDue: null,
    timeDue: null,
    dueDate: null,
    dueOdometer: null,
    dueBasis: null,
    daysRemaining: null,
    milesRemaining: null,
  };

  if (!hasMiles && !hasMonths) {
    return { ...base, status: 'unknown', reason: 'no-interval' };
  }
  if (!anchor) {
    return { ...base, status: 'unknown', reason: 'no-lease' };
  }

  // Time side: plain arithmetic on the anchor date, always available.
  let timeDue = null;
  if (hasMonths) {
    const d = addMonths(parseDateInput(anchor.date), item.interval_months);
    timeDue = { date: toYMD(d) };
  }

  // Miles side: needs both an anchor odometer and a live forecast.
  let milesDue = null;
  if (hasMiles && anchor.odometer != null) {
    const target = anchor.odometer + item.interval_miles;
    const hit = dateAtOdometer(forecast, target);
    if (hit) milesDue = { odometer: target, ...hit };
  }

  // Whichever comes first. A miles-based due point past the forecast horizon
  // loses to any real date rather than winning with a null.
  const candidates = [];
  if (milesDue?.date) candidates.push({ basis: 'miles', date: milesDue.date });
  if (timeDue?.date) candidates.push({ basis: 'time', date: timeDue.date });

  if (candidates.length === 0) {
    const reason =
      hasMiles && anchor.odometer == null
        ? 'no-odometer'
        : milesDue?.beyondHorizon
          ? 'beyond-horizon'
          : 'no-pace';
    return { ...base, milesDue, timeDue, status: 'unknown', reason };
  }

  candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const winner = candidates[0];

  const daysRemaining = daysBetween(
    parseDateInput(todayStr),
    parseDateInput(winner.date)
  );
  const latestOdo = lastForecastOdometerOn(forecast, todayStr);
  const milesRemaining =
    milesDue?.odometer != null && latestOdo != null
      ? Math.round(milesDue.odometer - latestOdo)
      : null;

  let status = 'ok';
  if (daysRemaining <= 0 || (milesRemaining != null && milesRemaining <= 0)) {
    status = 'overdue';
  } else if (
    daysRemaining <= SOON_DAYS ||
    (milesRemaining != null && milesRemaining <= SOON_MILES)
  ) {
    status = 'soon';
  }

  return {
    ...base,
    milesDue,
    timeDue,
    dueDate: winner.date,
    dueOdometer: winner.basis === 'miles' ? milesDue.odometer : null,
    dueBasis: winner.basis,
    daysRemaining,
    milesRemaining,
    status,
    reason: null,
  };
}

// Projected odometer on a given day, interpolated from the same monthly
// points — used only to express "how many miles left", never to log a
// reading. The odometer log stays the single ground truth for real miles.
export function lastForecastOdometerOn(forecast, dateStr) {
  const points = (forecast || []).filter((p) => p.projectedMiles != null);
  if (points.length === 0) return null;

  const target = parseDateInput(dateStr);
  if (target <= parseDateInput(points[0].date)) return points[0].projectedMiles;

  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const currDate = parseDateInput(curr.date);
    if (target > currDate) continue;

    const prevDate = parseDateInput(prev.date);
    const daySpan = daysBetween(prevDate, currDate);
    if (daySpan <= 0) return curr.projectedMiles;
    const fraction = daysBetween(prevDate, target) / daySpan;
    return (
      prev.projectedMiles +
      fraction * (curr.projectedMiles - prev.projectedMiles)
    );
  }
  return points[points.length - 1].projectedMiles;
}

const STATUS_RANK = { overdue: 0, soon: 1, ok: 2, unknown: 3 };

// Every active item's due state, most urgent first. Inactive items are
// computed too (so toggling one on doesn't need a refetch) but sort last.
export function maintenanceSummary({
  items,
  recordsByItem,
  forecast,
  settings,
  today,
}) {
  const rows = (items || []).map((item) => ({
    item,
    ...itemDueState({
      item,
      records: recordsByItem?.[item.id] || [],
      forecast,
      settings,
      today,
    }),
  }));

  rows.sort((a, b) => {
    if (a.item.active !== b.item.active) return a.item.active ? -1 : 1;
    const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rank !== 0) return rank;
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return (a.item.sort_order || 0) - (b.item.sort_order || 0);
  });

  return rows;
}

// The single line the Home card shows — the most urgent active item, or null
// when nothing needs attention. Returning null (rather than "all clear") is
// deliberate: the card renders no maintenance line at all in that case.
export function nearestDue(rows) {
  const candidate = (rows || []).find(
    (r) => r.item.active && (r.status === 'overdue' || r.status === 'soon')
  );
  return candidate || null;
}
