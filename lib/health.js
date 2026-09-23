// Health › Diet — pure math, no DB access, no server-only imports (same shape
// as lib/pto.js). Every function takes plain rows/strings and a `today` in and
// returns plain data, so the identical math runs in the /api/health routes and
// in the page without being written twice.
//
// Dates are always bare 'YYYY-MM-DD' strings and compare correctly with plain
// `<`/`<=` — never route them through `new Date(str)` for comparisons (see
// lib/db.js's dateOnly() and the 2026-07-15 UTC off-by-one fix in ROADMAP.md).

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

// The long-standing energy-balance approximation for a pound of body mass.
// It is a rule of thumb, not a measurement, which is exactly why the figures
// derived from it are always shown with the inputs that produced them.
const CAL_PER_LB = 3500;

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayYMD(now = new Date()) {
  return toYMD(now);
}

// Whole days from `fromStr` to `toStr`, both bare dates. Positive when `toStr`
// is later. Built on UTC instants of two date-only strings, so it is immune to
// the local-offset rollback that bites `new Date('YYYY-MM-DD')` arithmetic.
export function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return null;
  const from = Date.UTC(
    Number(fromStr.slice(0, 4)),
    Number(fromStr.slice(5, 7)) - 1,
    Number(fromStr.slice(8, 10))
  );
  const to = Date.UTC(
    Number(toStr.slice(0, 4)),
    Number(toStr.slice(5, 7)) - 1,
    Number(toStr.slice(8, 10))
  );
  return Math.round((to - from) / 86400000);
}

export function addDays(fromStr, days) {
  if (!fromStr || days == null || !Number.isFinite(days)) return null;
  const base = Date.UTC(
    Number(fromStr.slice(0, 4)),
    Number(fromStr.slice(5, 7)) - 1,
    Number(fromStr.slice(8, 10))
  );
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

// Steps-per-day bands mapped to the classical Mifflin–St Jeor activity-level
// multipliers (sedentary/light/moderate/very/extra) — a common practical
// extension of those categories to a step count, not a clinical standard.
// That's exactly why the multiplier it produces is always shown next to the
// step figure and the window that produced it (see computeTarget below),
// same treatment as every other derived number in this domain.
const STEP_ACTIVITY_BANDS = [
  { belowSteps: 5000, multiplier: 1.2, label: 'sedentary' },
  { belowSteps: 7500, multiplier: 1.375, label: 'lightly active' },
  { belowSteps: 10000, multiplier: 1.55, label: 'moderately active' },
  { belowSteps: 12500, multiplier: 1.725, label: 'very active' },
  { belowSteps: Infinity, multiplier: 1.9, label: 'extra active' },
];

export function stepsToActivityMultiplier(avgSteps) {
  const band =
    STEP_ACTIVITY_BANDS.find((b) => avgSteps < b.belowSteps) ||
    STEP_ACTIVITY_BANDS[STEP_ACTIVITY_BANDS.length - 1];
  return { multiplier: band.multiplier, label: band.label };
}

// Averages only the days that actually have a steps reading inside the
// window — a day with no entry is excluded, never treated as zero (that
// would silently drag the average, and the multiplier, down) and never
// backfilled from a neighboring day. Returns null if nothing is logged in
// the window at all.
export function trailingStepsAverage(stepsRows, todayStr, windowDays) {
  const from = addDays(todayStr, -(windowDays - 1));
  const inWindow = (stepsRows || []).filter(
    (r) =>
      r.steps != null && r.reading_date >= from && r.reading_date <= todayStr
  );
  if (inWindow.length === 0) return null;
  const total = inWindow.reduce((sum, r) => sum + Number(r.steps), 0);
  return { average: total / inWindow.length, daysLogged: inWindow.length };
}

// Age prefers birth_date because it is the only representation that cannot go
// stale; age_years is the fallback John can type instead. Never guesses one
// from the other — returns null when it has neither.
export function resolveAge(profile, todayStr) {
  if (profile?.birth_date) {
    const days = daysBetween(profile.birth_date, todayStr);
    if (days == null || days < 0) return null;
    return Math.floor(days / 365.2425);
  }
  if (profile?.age_years != null) return Number(profile.age_years);
  return null;
}

// Mifflin–St Jeor. Published population regression — roughly ±10% on any one
// individual, which is why every figure downstream of it is displayed with the
// formula name and its inputs rather than as a bare authoritative number.
// Returns null rather than a partial answer when any input is missing.
export function basalRate({ sex, weightLb, heightIn, age }) {
  if (!sex || weightLb == null || heightIn == null || age == null) return null;
  const kg = Number(weightLb) * KG_PER_LB;
  const cm = Number(heightIn) * CM_PER_IN;
  const base = 10 * kg + 6.25 * cm - 5 * Number(age);
  return Math.round(base + (sex === 'male' ? 5 : -161));
}

// Sums whichever entries actually carry a macro — never zero-fills a missing
// one, the same rule as steps on health_weight_readings. A macro total is
// only as complete as the entries that logged it, so `complete` says whether
// every entry this day has it; the UI must show that alongside the number
// rather than let a partial sum read as the whole day's protein.
function macroTotal(rows, field) {
  const withValue = rows.filter((e) => e[field] != null);
  if (withValue.length === 0) return { value: null, complete: false };
  const value = withValue.reduce((sum, e) => sum + Number(e[field]), 0);
  return { value, complete: withValue.length === rows.length };
}

export function dayTotals(entries) {
  const rows = entries || [];
  const total = rows.reduce((sum, e) => sum + (Number(e.calories) || 0), 0);
  // A single non-label entry makes the whole total an estimate. That is the
  // tilde's entire meaning — same number, weaker claim.
  const estimated = rows.some((e) => e.source !== 'label');
  const mealsLogged = new Set(rows.map((e) => e.meal)).size;
  const protein = macroTotal(rows, 'protein_g');
  const carbs = macroTotal(rows, 'carbs_g');
  const fat = macroTotal(rows, 'fat_g');
  // Unlike the macros, veggie_servings is NOT NULL DEFAULT 0 (migration 035),
  // so a plain sum is honest: an entry nobody assessed can only under-count,
  // which reads as "baseline not met", never as a fabricated success.
  const veggieServings = rows.reduce(
    (sum, e) => sum + (Number(e.veggie_servings) || 0),
    0
  );
  return {
    total,
    estimated,
    mealsLogged,
    entryCount: rows.length,
    proteinG: protein.value,
    proteinComplete: protein.complete,
    carbsG: carbs.value,
    carbsComplete: carbs.complete,
    fatG: fat.value,
    fatComplete: fat.complete,
    veggieServings,
  };
}

// Water is stored in US fluid ounces. A "cup" is the 8 fl oz US cup — the
// one John means by "an eight ounce cup" — and ml converts at the fluid
// ounce's exact 29.5735 ml. Returns ounces rounded to 0.1, or null for a
// bad amount/unit so the caller can answer with a clear error.
const OZ_PER = { oz: 1, cup: 8, ml: 1 / 29.5735 };
export const WATER_UNITS = Object.keys(OZ_PER);
export function toWaterOunces(amount, unit = 'oz') {
  const n = Number(amount);
  const per = OZ_PER[unit];
  if (!per || !Number.isFinite(n) || n <= 0) return null;
  const oz = Math.round(n * per * 10) / 10;
  return oz > 0 && oz <= 999 ? oz : null;
}

// The day's water against the optional goal: plain water (one row per
// drink) plus the liquid of any food entry that is a drink (fluid_oz,
// counted in full — see migration 037). The two parts are returned
// separately so the page can always show how much is a drink estimate. No
// goal → `met: null`, never a verdict against a number John didn't set.
const r1 = (n) => Math.round(n * 10) / 10;
export function waterProgress(entries, targetOz, foodEntries = []) {
  const plain = r1(
    (entries || []).reduce((sum, e) => sum + (Number(e.ounces) || 0), 0)
  );
  const drinkFoods = (foodEntries || []).filter((e) => Number(e.fluid_oz) > 0);
  const fromDrinks = r1(
    drinkFoods.reduce((sum, e) => sum + Number(e.fluid_oz), 0)
  );
  const total = r1(plain + fromDrinks);
  const target = targetOz == null ? null : Number(targetOz);
  return {
    ounces: total,
    cups: r1(total / 8),
    plainOunces: plain,
    fromDrinksOunces: fromDrinks,
    drinks: (entries || []).length,
    drinkFoods: drinkFoods.length,
    target,
    met: target == null ? null : total >= target,
  };
}

// Parses a fluid_oz input: blank/null → null (not a drink); a positive
// number → rounded to 0.1; anything else → undefined so the caller can 400.
export function parseFluidOz(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 999) return undefined;
  return r1(n);
}

// Parses a veggie_servings input for the HTTP routes. Blank/null means 0
// (the column is NOT NULL DEFAULT 0); returns undefined for an invalid value
// so the route can answer 400.
export function parseVeggieServings(value) {
  if (value == null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 999) return undefined;
  return Math.round(n * 10) / 10;
}

// The day's vegetable servings against the profile's baseline
// (veggie_target_servings, default 2). `met` is null when there is no target
// to compare against rather than guessing one. A day with nothing logged is
// reported as not met — callers already show the completeness signal beside
// it, so "not met" there reads as "not logged", not as a verdict.
export function veggieProgress(servings, target) {
  const t = target == null ? null : Number(target);
  return {
    servings: Math.round((Number(servings) || 0) * 10) / 10,
    target: t,
    met: t == null ? null : Number(servings) >= t,
  };
}

// The target, with everything needed to show its work. Never returns a bare
// number: `provenance` says where it came from, `steps` carries the arithmetic
// the UI renders, and `clamped` says the goal date slipped rather than the
// target bending to meet it.
//
// Shape of the decision:
//   manual_target_cal set  → that number IS the target; the formula stops.
//   otherwise              → maintenance − (deficit the goal requires),
//                            floored, with the slip reported honestly.
export function computeTarget({ profile, latestWeight, todayStr, stepsRows }) {
  const result = {
    target: null,
    provenance: null,
    bmr: null,
    maintenance: null,
    deficit: null,
    floor: null,
    clamped: false,
    weightLb: null,
    weightDate: null,
    weightAgeDays: null,
    age: null,
    requiredRatePerWeek: null,
    projectedDate: null,
    daysToGoal: null,
    activityMultiplier: null,
    activityProvenance: null,
    activityLabel: null,
    activityAvgSteps: null,
    activityWindowDays: null,
    activityDaysLogged: null,
    activityMinDaysNeeded: null,
    missing: [],
  };
  if (!profile) {
    result.missing.push('profile');
    return result;
  }

  if (latestWeight) {
    result.weightLb = Number(latestWeight.weight_lb);
    result.weightDate = latestWeight.reading_date;
    result.weightAgeDays = daysBetween(latestWeight.reading_date, todayStr);
  }

  // A manual override wins before anything else is computed, so a doctor's
  // number is never quietly blended with a formula result.
  if (profile.manual_target_cal != null) {
    result.target = Number(profile.manual_target_cal);
    result.provenance = 'manual';
    return result;
  }

  result.age = resolveAge(profile, todayStr);
  if (!profile.sex) result.missing.push('sex');
  if (profile.height_in == null) result.missing.push('height');
  if (result.age == null) result.missing.push('age');
  if (result.weightLb == null) result.missing.push('weight');

  result.bmr = basalRate({
    sex: profile.sex,
    weightLb: result.weightLb,
    heightIn: profile.height_in,
    age: result.age,
  });
  if (result.bmr == null) return result;

  // Manual is the default and the fallback: a multiplier John typed in
  // himself. Steps-trailing is opt-in per profile (activity_source), and
  // even then only takes over once the window has enough real days logged
  // — otherwise this would silently swing the target on one or two data
  // points, which is worse than the manual number it would replace.
  let multiplier = Number(profile.activity_multiplier) || 1;
  result.activityMultiplier = multiplier;
  result.activityProvenance = 'manual';

  if (profile.activity_source === 'steps_trailing') {
    const windowDays = Number(profile.activity_trailing_days) || 14;
    const minDaysNeeded = Math.ceil(windowDays / 2);
    result.activityWindowDays = windowDays;
    result.activityMinDaysNeeded = minDaysNeeded;

    const trailing = trailingStepsAverage(stepsRows, todayStr, windowDays);
    result.activityDaysLogged = trailing?.daysLogged || 0;

    if (trailing && trailing.daysLogged >= minDaysNeeded) {
      const { multiplier: stepsMultiplier, label } = stepsToActivityMultiplier(
        trailing.average
      );
      multiplier = stepsMultiplier;
      result.activityMultiplier = stepsMultiplier;
      result.activityProvenance = 'steps_trailing';
      result.activityLabel = label;
      result.activityAvgSteps = Math.round(trailing.average);
    } else {
      // Not enough logged days yet — hold at the manual multiplier rather
      // than compute a trailing average from a handful of points, and say
      // so plainly instead of quietly falling back.
      result.activityProvenance = 'steps_trailing_pending';
    }
  }

  result.maintenance = Math.round(result.bmr * multiplier);

  result.floor =
    profile.manual_floor_cal != null
      ? Number(profile.manual_floor_cal)
      : Math.round(result.maintenance * (Number(profile.floor_pct) || 0.6));

  // No goal means no deficit to apply — maintenance is the honest target.
  const goalLb =
    profile.goal_weight_lb == null ? null : Number(profile.goal_weight_lb);
  if (goalLb == null || !profile.goal_date) {
    result.target = result.maintenance;
    result.deficit = 0;
    result.provenance = 'formula';
    if (goalLb == null) result.missing.push('goal_weight');
    if (!profile.goal_date) result.missing.push('goal_date');
    return result;
  }

  const gapLb = result.weightLb - goalLb;
  const daysLeft = daysBetween(todayStr, profile.goal_date);
  result.daysToGoal = daysLeft;
  result.provenance = 'formula';

  // Goal already met, or the date has passed — either way there is no rate to
  // back-solve, so hold at maintenance rather than emit a nonsense deficit.
  if (gapLb <= 0 || daysLeft == null || daysLeft <= 0) {
    result.target = result.maintenance;
    result.deficit = 0;
    return result;
  }

  result.requiredRatePerWeek = (gapLb / daysLeft) * 7;
  const requiredDeficit = Math.round((gapLb * CAL_PER_LB) / daysLeft);
  const raw = result.maintenance - requiredDeficit;

  if (raw < result.floor) {
    // Clamp and slip: the target stops at the floor and the DATE moves. The
    // app never bends the target to hit a date it cannot safely hit.
    result.clamped = true;
    result.target = result.floor;
    result.deficit = result.maintenance - result.floor;
    if (result.deficit > 0) {
      const daysNeeded = Math.ceil((gapLb * CAL_PER_LB) / result.deficit);
      result.projectedDate = addDays(todayStr, daysNeeded);
    }
    return result;
  }

  result.target = raw;
  result.deficit = requiredDeficit;
  return result;
}
