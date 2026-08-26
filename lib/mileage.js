import { parseDateInput } from './format';

// Mileage calculator — pure math, no DB access, no server-only imports (same
// shape as lib/pto.js so the exact functions run both server-side (/api/mileage)
// and client-side (app/mileage/page.jsx), never duplicated. Dates in/out are
// bare 'YYYY-MM-DD' strings — see lib/db.js's dateOnly() and lib/format.js's
// parseDateInput() for why these never go through plain `new Date(str)`.

const DAY_MS = 24 * 60 * 60 * 1000;
const CHECKPOINT_YEARS = [1, 2, 3];

// Average days per period, for converting a "usual trips" rate to a daily
// pace. Month uses the Gregorian average (365.2425 / 12) rather than a bare
// 30 — close enough over a multi-year lease that the difference never shows
// up rounded to whole miles.
const PERIOD_DAYS = { day: 1, week: 7, month: 30.436875 };

export function usualPaceMilesPerDay(usualMiles, usualPeriod) {
  const days = PERIOD_DAYS[usualPeriod] || PERIOD_DAYS.week;
  return usualMiles / days;
}

// The "usual trips" detail popup's running total — a weekly figure, since
// each leg's frequency is expressed as times/week. Pure so the popup can
// show the live total client-side as legs are added/removed, same as every
// other shared computation in this module.
export function usualLegsWeeklyTotal(legs) {
  return (legs || []).reduce(
    (sum, leg) =>
      sum + Number(leg.miles || 0) * Number(leg.times_per_week || 0),
    0
  );
}

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

// Settings are configurable independently — a fresh install has no lease info
// yet, and the page must say so honestly rather than compute against nulls.
export function isConfigured(settings) {
  return !!(settings?.lease_start_date && settings?.starting_odometer != null);
}

// Current pace (mi/day), derived from the lease-start odometer and the most
// recent logged reading — not a fixed "today", so logging a reading with an
// earlier date than the previous one is simply the new latest by date order.
// No readings yet → pace is null (not zero — zero would claim "on pace",
// which nothing supports yet).
export function currentPace({ leaseStart, startingOdometer, readings }) {
  const sorted = [...(readings || [])].sort((a, b) =>
    a.reading_date < b.reading_date
      ? -1
      : a.reading_date > b.reading_date
        ? 1
        : 0
  );
  const latest = sorted[sorted.length - 1] || null;
  if (!latest) {
    return {
      pace: null,
      milesElapsed: 0,
      daysElapsed: 0,
      latestOdometer: startingOdometer,
      latestDate: null,
    };
  }
  const daysElapsed = Math.max(
    1,
    daysBetween(parseDateInput(leaseStart), parseDateInput(latest.reading_date))
  );
  const milesElapsed = latest.odometer - startingOdometer;
  return {
    pace: milesElapsed / daysElapsed,
    milesElapsed,
    daysElapsed,
    latestOdometer: latest.odometer,
    latestDate: latest.reading_date,
  };
}

export function checkpointDate(leaseStart, n) {
  return toYMD(addMonths(parseDateInput(leaseStart), 12 * n));
}

// A scenario built from a usual-trip leg's frequency change ("cafe: 2x/wk
// -> 3x/wk") rather than a manually typed mile guess — "what if" scenarios
// like this are how John wants to express a routine change. The extra
// weekly mileage is extrapolated linearly from lease start to each
// checkpoint, the same model the pace baseline itself already uses, so a
// leg-based scenario's numbers stay on the same footing as every other
// figure on the page.
export function legFrequencyScenarioImpacts({
  leaseStart,
  leg,
  newTimesPerWeek,
}) {
  const extraMilesPerWeek =
    Number(leg.miles || 0) *
    (Number(newTimesPerWeek || 0) - Number(leg.times_per_week || 0));
  const extraPerDay = extraMilesPerWeek / 7;

  const impacts = {};
  for (const n of CHECKPOINT_YEARS) {
    const daysToCheckpoint = daysBetween(
      parseDateInput(leaseStart),
      parseDateInput(checkpointDate(leaseStart, n))
    );
    impacts[`impact_${n}yr`] = Math.round(extraPerDay * daysToCheckpoint);
  }
  return { extraMilesPerWeek, ...impacts };
}

// One checkpoint (n = 1, 2, or 3 years from lease start): baseline projection
// (straight-line from current pace) plus every *active* scenario's mileage
// impact for that checkpoint. A null pace (no readings logged yet) projects
// as "unknown" rather than a false zero.
export function projectCheckpoint({
  leaseStart,
  startingOdometer,
  pace,
  n,
  annualAllowanceMiles,
  overageRateCents,
  scenarios,
}) {
  const date = checkpointDate(leaseStart, n);
  const daysToCheckpoint = daysBetween(
    parseDateInput(leaseStart),
    parseDateInput(date)
  );
  const allowanceMiles = annualAllowanceMiles * n;

  if (pace == null) {
    return {
      n,
      date,
      allowanceMiles,
      projectedMiles: null,
      deltaMiles: null,
      overageMiles: 0,
      overageCost: 0,
    };
  }

  const baselineMiles = startingOdometer + pace * daysToCheckpoint;
  const scenarioAdd = (scenarios || []).reduce((sum, s) => {
    if (!s.active) return sum;
    const key = `impact_${n}yr`;
    return sum + (Number(s[key]) || 0);
  }, 0);
  const projectedMiles = baselineMiles + scenarioAdd;
  const deltaMiles = projectedMiles - allowanceMiles;
  const overageMiles = Math.max(0, deltaMiles);
  const overageCost = (overageMiles * (overageRateCents || 0)) / 100;

  return {
    n,
    date,
    allowanceMiles,
    projectedMiles,
    deltaMiles,
    overageMiles,
    overageCost,
  };
}

// Full computed view for the page + Home card: pace info plus all three
// checkpoints, given the settings/readings/scenarios rows as loaded from DB.
//
// Baseline selection: by default the checkpoint baseline is the logged-pace
// figure (from the odometer log, via currentPace()). If John has checked
// "usual trips" (settings.usual_active, with a positive usual_miles), that
// routine rate — converted to a daily pace — REPLACES the logged pace as the
// baseline instead; active scenarios still add on top either way. The
// logged pace itself (`pace` below) is always returned as-is for display,
// even when it isn't the baseline in use — never silently hidden.
export function mileageSummary({ settings, readings, scenarios }) {
  if (!isConfigured(settings)) {
    return { configured: false, pace: null, checkpoints: [] };
  }
  const leaseStart = settings.lease_start_date;
  const startingOdometer = settings.starting_odometer;
  const annualAllowanceMiles = settings.annual_allowance_miles;
  const overageRateCents = settings.overage_rate_cents;

  const paceInfo = currentPace({ leaseStart, startingOdometer, readings });

  const usualMiles =
    settings.usual_miles != null ? Number(settings.usual_miles) : null;
  const usualActive =
    !!settings.usual_active && usualMiles != null && usualMiles > 0;
  const usualPace =
    usualMiles != null && usualMiles > 0
      ? usualPaceMilesPerDay(usualMiles, settings.usual_period || 'week')
      : null;

  const baselineSource = usualActive ? 'usual' : 'actual';
  const baselinePace = usualActive ? usualPace : paceInfo.pace;

  const checkpoints = CHECKPOINT_YEARS.map((n) =>
    projectCheckpoint({
      leaseStart,
      startingOdometer,
      pace: baselinePace,
      n,
      annualAllowanceMiles,
      overageRateCents,
      scenarios,
    })
  );

  return {
    configured: true,
    ...paceInfo,
    usualPace,
    usualActive,
    baselineSource,
    checkpoints,
  };
}
