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

// Scenario timing (migration 025) — a scenario now says WHEN it's expected
// to happen, not just how much it adds. 'recurring' scales the scenario's
// already-stored impact_Nyr proportionally: that figure was computed
// assuming the change ran the whole lease-start-to-checkpoint span, so if
// `effective_start` (default: lease start, i.e. unchanged from pre-025
// behavior) pushes the start later, only the fraction of that span
// actually spent "active" counts. 'one_time' ignores impact_Nyr entirely —
// it's a flat `one_time_miles` that lands in full once its dated span has
// passed by a given checkpoint, and is zero before that, mirroring how a
// Travel Day Exclusion only subtracts once its trip has ended.
export function scenarioImpactForCheckpoint({ scenario, leaseStart, checkpointDate, n }) {
  if (!scenario.active) return 0;

  if (scenario.occurrence === 'one_time') {
    const landsBy = scenario.one_time_end || scenario.one_time_start;
    if (!landsBy) return 0;
    if (parseDateInput(checkpointDate) < parseDateInput(landsBy)) return 0;
    return Number(scenario.one_time_miles) || 0;
  }

  const storedImpact = Number(scenario[`impact_${n}yr`]) || 0;
  const effectiveStart = scenario.effective_start || leaseStart;
  const totalDays = daysBetween(
    parseDateInput(leaseStart),
    parseDateInput(checkpointDate)
  );
  if (totalDays <= 0) return 0;
  const activeDays = Math.min(
    totalDays,
    Math.max(
      0,
      daysBetween(parseDateInput(effectiveStart), parseDateInput(checkpointDate))
    )
  );
  return storedImpact * (activeDays / totalDays);
}

// Scenario impact at ANY date, not just a 1/2/3-yr checkpoint. 'one_time'
// already works for any date (a step at its landing date); 'recurring'
// piecewise-linearly interpolates across the same lease-start (0mi) and
// 1/2/3-yr anchors scenarioImpactForCheckpoint uses, so a monthly point
// here always agrees with the checkpoint tiles at the exact checkpoint
// dates — never a second formula that could quietly drift from them.
export function scenarioImpactAt({ scenario, leaseStart, targetDate }) {
  if (!scenario.active) return 0;

  if (scenario.occurrence === 'one_time') {
    const landsBy = scenario.one_time_end || scenario.one_time_start;
    if (!landsBy) return 0;
    return parseDateInput(targetDate) < parseDateInput(landsBy)
      ? 0
      : Number(scenario.one_time_miles) || 0;
  }

  const targetDays = daysBetween(
    parseDateInput(leaseStart),
    parseDateInput(targetDate)
  );
  if (targetDays <= 0) return 0;

  const marks = [
    { days: 0, impact: 0 },
    ...CHECKPOINT_YEARS.map((n) => {
      const date = checkpointDate(leaseStart, n);
      return {
        days: daysBetween(parseDateInput(leaseStart), parseDateInput(date)),
        impact: scenarioImpactForCheckpoint({
          scenario,
          leaseStart,
          checkpointDate: date,
          n,
        }),
      };
    }),
  ];
  for (let i = 1; i < marks.length; i++) {
    if (targetDays <= marks[i].days) {
      const a = marks[i - 1];
      const b = marks[i];
      const t = b.days === a.days ? 0 : (targetDays - a.days) / (b.days - a.days);
      return a.impact + (b.impact - a.impact) * t;
    }
  }
  return marks[marks.length - 1].impact;
}

// Projected odometer at any date — same inputs and convention as
// projectCheckpoint, generalized past the fixed 1/2/3-yr marks. This is
// what lets a monthly chart show the step a one-time scenario's landing
// produces, which a line with only 4 vertices (anchor + 3 checkpoints)
// smooths away entirely.
export function projectAt({
  leaseStart,
  anchorDate,
  anchorOdometer,
  pace,
  targetDate,
  scenarios,
  exclusions,
}) {
  if (pace == null) return null;
  const daysFromAnchor = Math.max(
    0,
    daysBetween(parseDateInput(anchorDate), parseDateInput(targetDate))
  );
  const baselineMiles = anchorOdometer + pace * daysFromAnchor;
  const scenarioAdd = Math.round(
    (scenarios || []).reduce(
      (sum, s) =>
        sum + scenarioImpactAt({ scenario: s, leaseStart, targetDate }),
      0
    )
  );
  const exclusionSubtract = (exclusions || []).reduce((sum, e) => {
    if (parseDateInput(e.end_date) > parseDateInput(targetDate)) return sum;
    return sum + (Number(e.miles_excluded) || 0);
  }, 0);
  return baselineMiles + scenarioAdd - exclusionSubtract;
}

// One point per calendar month from lease start through the 3-yr mark —
// the Forecast Dashboard chart's monthly view, so a one-time scenario's
// landing shows up as a visible step instead of being invisible between
// two yearly checkpoints. `landings` names which active scenarios land in
// each point's month, so the chart can mark the bump instead of leaving it
// to speak for itself.
export function monthlyForecast({ settings, readings, scenarios, exclusions }) {
  if (!isConfigured(settings)) return [];
  const leaseStart = settings.lease_start_date;
  const startingOdometer = settings.starting_odometer;
  const paceInfo = currentPace({ leaseStart, startingOdometer, readings });
  if (paceInfo.pace == null) return [];

  const anchorDate = paceInfo.latestDate || leaseStart;
  const anchorOdometer = paceInfo.latestOdometer;

  const usualMiles =
    settings.usual_miles != null ? Number(settings.usual_miles) : null;
  const usualActive =
    !!settings.usual_active && usualMiles != null && usualMiles > 0;
  const pace = usualActive
    ? usualPaceMilesPerDay(usualMiles, settings.usual_period || 'week')
    : paceInfo.pace;

  const acceptedExclusions = (exclusions || []).filter(
    (e) => e.status === 'accepted'
  );
  const activeScenarios = (scenarios || []).filter((s) => s.active);
  const end = parseDateInput(checkpointDate(leaseStart, 3));

  const points = [];
  let cursor = parseDateInput(leaseStart);
  while (cursor <= end) {
    const dateStr = toYMD(cursor);
    const projectedMiles = projectAt({
      leaseStart,
      anchorDate,
      anchorOdometer,
      pace,
      targetDate: dateStr,
      scenarios: activeScenarios,
      exclusions: acceptedExclusions,
    });
    // A "landing" is a scenario whose one-time bump first shows up between
    // the previous point and this one — flagged here so the chart can mark
    // exactly which scenario caused a jump, not just that one happened.
    const landings = activeScenarios.filter((s) => {
      if (s.occurrence !== 'one_time') return false;
      const landsBy = s.one_time_end || s.one_time_start;
      if (!landsBy) return false;
      const landDate = parseDateInput(landsBy);
      const prevCursor = addMonths(cursor, -1);
      return landDate > prevCursor && landDate <= cursor;
    });
    points.push({ date: dateStr, projectedMiles, landings });
    cursor = addMonths(cursor, 1);
  }
  return points;
}

// Travel Day Exclusions — a real, one-time fact ("I wasn't home driving
// these days"), distinct from a Forecast Scenario's hypothetical recurring
// routine change. Whole days are excluded, not just weekends: while
// traveling, none of the normal daily driving happens. Computed once at
// accept time from whichever baseline pace is currently active, so the
// snapshot never silently drifts if the pace changes later.
export function tripDayCount(startDate, endDate) {
  return daysBetween(parseDateInput(startDate), parseDateInput(endDate)) + 1;
}

export function travelExclusionMiles({ dailyRate, days }) {
  if (dailyRate == null || !Number.isFinite(dailyRate)) return 0;
  return Math.round(dailyRate * days);
}

// One checkpoint (n = 1, 2, or 3 years from lease start): a straight line
// from the most recent REAL data point (the latest logged odometer reading,
// or the starting odometer if none logged yet) forward to the checkpoint
// date, using whichever pace is the active baseline. This is true whether
// that pace is the logged-history average or the "usual trips" override —
// the override only ever replaces the *forward-looking rate*, never the
// actual miles already on the odometer. Then every *active* scenario's
// mileage impact for that checkpoint, minus any accepted Travel Day
// Exclusion whose trip has already ended by this checkpoint's date (a
// future-dated exclusion shouldn't reduce a checkpoint it hasn't happened
// by yet). A null pace (no readings logged yet) projects as "unknown"
// rather than a false zero.
export function projectCheckpoint({
  leaseStart,
  anchorDate,
  anchorOdometer,
  pace,
  n,
  annualAllowanceMiles,
  overageRateCents,
  scenarios,
  exclusions,
}) {
  const date = checkpointDate(leaseStart, n);
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

  // If a checkpoint date has already passed the latest logged reading, there
  // are no more days to extrapolate — the real reading itself is the best
  // known figure for it, not a nonsensical backward projection.
  const daysFromAnchor = Math.max(
    0,
    daysBetween(parseDateInput(anchorDate), parseDateInput(date))
  );
  const baselineMiles = anchorOdometer + pace * daysFromAnchor;
  const scenarioAdd = Math.round(
    (scenarios || []).reduce(
      (sum, s) =>
        sum +
        scenarioImpactForCheckpoint({
          scenario: s,
          leaseStart,
          checkpointDate: date,
          n,
        }),
      0
    )
  );
  const exclusionSubtract = (exclusions || []).reduce((sum, e) => {
    if (parseDateInput(e.end_date) > parseDateInput(date)) return sum;
    return sum + (Number(e.miles_excluded) || 0);
  }, 0);
  const projectedMiles = baselineMiles + scenarioAdd - exclusionSubtract;
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
// baseline instead; active scenarios still add on top either way. Either
// way, every checkpoint is a straight line forward from the actual latest
// logged odometer reading (or the starting odometer if none logged yet) —
// "usual trips" only overrides the *forward-looking rate*, never the miles
// John has actually already driven, so logging a reading always corrects
// the forecast's anchor point regardless of which baseline is active. The
// logged pace itself (`pace` below) is always returned as-is for display,
// even when it isn't the baseline in use — never silently hidden.
export function mileageSummary({ settings, readings, scenarios, exclusions }) {
  if (!isConfigured(settings)) {
    return { configured: false, pace: null, checkpoints: [] };
  }
  const leaseStart = settings.lease_start_date;
  const startingOdometer = settings.starting_odometer;
  const annualAllowanceMiles = settings.annual_allowance_miles;
  const overageRateCents = settings.overage_rate_cents;

  const paceInfo = currentPace({ leaseStart, startingOdometer, readings });
  const anchorDate = paceInfo.latestDate || leaseStart;
  const anchorOdometer = paceInfo.latestOdometer;

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

  const acceptedExclusions = (exclusions || []).filter(
    (e) => e.status === 'accepted'
  );

  const checkpoints = CHECKPOINT_YEARS.map((n) =>
    projectCheckpoint({
      leaseStart,
      anchorDate,
      anchorOdometer,
      pace: baselinePace,
      n,
      annualAllowanceMiles,
      overageRateCents,
      scenarios,
      exclusions: acceptedExclusions,
    })
  );

  return {
    configured: true,
    ...paceInfo,
    usualPace,
    usualActive,
    baselineSource,
    baselinePace,
    checkpoints,
  };
}
