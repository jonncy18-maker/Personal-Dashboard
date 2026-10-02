import { describe, expect, it } from 'vitest';
import {
  addDays,
  computeTarget,
  dayTotals,
  isValidDate,
  fiberProgress,
  fruitProgress,
  SATURATED_FAT_MIN_CALORIE_COVERAGE,
  stepsToActivityMultiplier,
} from './health';

const entry = (overrides = {}) => ({
  calories: 100,
  meal: 'snack',
  source: 'label',
  ...overrides,
});

describe('nutrition totals', () => {
  it('keeps unknown nutrients distinct from real zero', () => {
    const unknown = dayTotals([entry()]);
    expect(unknown.fiberG).toBeNull();
    expect(unknown.fiberComplete).toBe(false);
    expect(unknown.saturatedFatG).toBeNull();
    expect(unknown.saturatedFatStatus).toBe('incomplete');
    expect(unknown.fruitServings).toBe(0);

    const zero = dayTotals([entry({ fiber_g: 0, saturated_fat_g: 0 })]);
    expect(zero.fiberG).toBe(0);
    expect(zero.fiberComplete).toBe(true);
    expect(zero.saturatedFatG).toBe(0);
    expect(zero.saturatedFatStatus).toBe('green');
  });

  it('sums stated fruit servings and compares with the profile target', () => {
    const totals = dayTotals([
      entry({ fruit_servings: 0.5 }),
      entry({ fruit_servings: 0.5 }),
      entry(),
    ]);
    expect(totals.fruitServings).toBe(1);
    expect(fruitProgress(totals.fruitServings, 1).met).toBe(true);
    expect(fruitProgress(0, 1).met).toBe(false);
    expect(fruitProgress(1, null).met).toBeNull();
  });

  it('reports a partial fiber sum and no target verdict without data', () => {
    const totals = dayTotals([entry({ fiber_g: 5 }), entry()]);
    expect(totals.fiberG).toBe(5);
    expect(totals.fiberComplete).toBe(false);
    expect(fiberProgress(totals.fiberG, 30).met).toBe(false);
    expect(fiberProgress(null, 30).met).toBeNull();
    expect(fiberProgress(30, null).met).toBeNull();
  });

  it('treats a label-based Citrucel favorite log as an ordinary intake entry', () => {
    const totals = dayTotals([
      entry({
        calories: 35,
        fiber_g: 2,
        saturated_fat_g: 0,
        veggie_servings: 0,
        fruit_servings: 0,
      }),
    ]);
    expect(totals.total).toBe(35);
    expect(totals.fiberG).toBe(2);
    expect(totals.estimated).toBe(false);
    expect(totals.veggieServings).toBe(0);
    expect(totals.fruitServings).toBe(0);
  });

  it('uses only measured entries in the saturated-fat denominator', () => {
    const totals = dayTotals([
      entry({ calories: 900, saturated_fat_g: 9 }),
      entry({ calories: 100 }),
    ]);
    expect(totals.saturatedFatG).toBe(9);
    expect(totals.saturatedFatComplete).toBe(false);
    expect(totals.saturatedFatPctCalories).toBe(9);
    expect(totals.saturatedFatStatus).toBe('yellow');
    expect(SATURATED_FAT_MIN_CALORIE_COVERAGE).toBe(0.9);
  });

  it('uses the 6% and 10% boundaries and blocks a verdict below 90% coverage', () => {
    expect(
      dayTotals([entry({ calories: 900, saturated_fat_g: 6 })])
        .saturatedFatStatus
    ).toBe('green');
    expect(
      dayTotals([entry({ calories: 900, saturated_fat_g: 10 })])
        .saturatedFatStatus
    ).toBe('yellow');
    expect(
      dayTotals([entry({ calories: 900, saturated_fat_g: 10.1 })])
        .saturatedFatStatus
    ).toBe('red');
    const partial = dayTotals([
      entry({ calories: 899, saturated_fat_g: 0 }),
      entry({ calories: 101 }),
    ]);
    expect(partial.saturatedFatStatus).toBe('incomplete');
    expect(partial.saturatedFatPctCalories).toBe(0);
    expect(dayTotals([]).saturatedFatStatus).toBe('incomplete');
  });
});

describe('daily nutrition totals (override)', () => {
  it('replaces a partial per-entry sum and counts as complete', () => {
    const rows = [entry({ fiber_g: 3 }), entry()];
    const totals = dayTotals(rows, { fiber_g: 24, source: 'estimated' });
    expect(totals.fiberG).toBe(24);
    expect(totals.fiberComplete).toBe(true);
    expect(totals.fiberFromDayTotal).toBe(true);
    expect(totals.dayTotalSource).toBe('estimated');
  });

  it('only touches the nutrient it names', () => {
    const rows = [entry({ calories: 500, saturated_fat_g: 5 })];
    const totals = dayTotals(rows, { fiber_g: 20, source: 'recall' });
    expect(totals.fiberG).toBe(20);
    expect(totals.saturatedFatFromDayTotal).toBe(false);
    expect(totals.saturatedFatG).toBe(5);
  });

  it('grades saturated fat from a day total against the whole day', () => {
    const rows = [entry({ calories: 1000 }), entry({ calories: 1000 })];
    const at = (g) =>
      dayTotals(rows, { saturated_fat_g: g, source: 'estimated' });
    expect(at(13.3).saturatedFatStatus).toBe('green');
    expect(at(13.4).saturatedFatStatus).toBe('yellow');
    expect(at(22.2).saturatedFatStatus).toBe('yellow');
    expect(at(22.3).saturatedFatStatus).toBe('red');
    expect(at(0).saturatedFatStatus).toBe('green');
    expect(at(13.3).saturatedFatComplete).toBe(true);
  });

  it('stays incomplete with no calories and never greens without data', () => {
    expect(
      dayTotals([], { saturated_fat_g: 5, source: 'estimated' })
        .saturatedFatStatus
    ).toBe('incomplete');
    expect(dayTotals([entry()], null).saturatedFatStatus).toBe('incomplete');
    expect(
      dayTotals([entry()], { fiber_g: 10, source: 'recall' }).saturatedFatStatus
    ).toBe('incomplete');
  });

  it('validates real calendar dates', () => {
    expect(isValidDate('2026-09-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('9/28/2026')).toBe(false);
    expect(isValidDate(undefined)).toBe(false);
  });
});

describe('prior-day step adjustment', () => {
  const TODAY = '2026-09-30';
  const profile = {
    sex: 'male',
    birth_date: '1993-12-10',
    height_in: 62,
    activity_multiplier: 1.75,
    activity_source: 'manual',
    activity_trailing_days: 14,
    floor_pct: 0.6,
    goal_weight_lb: 112,
    goal_date: '2026-10-28',
    step_adjust_enabled: true,
    step_adjust_pct: 0.5,
  };
  const weight = { reading_date: '2026-09-30', weight_lb: 118 };

  // A steady 12,000-step baseline across the window ending the day before
  // yesterday (09-15..09-28), then whatever yesterday and today are.
  function steps({ yesterday, today, baselineDays = 14 } = {}) {
    const rows = [];
    for (let i = 0; i < baselineDays; i += 1) {
      rows.push({ reading_date: addDays('2026-09-28', -i), steps: 12000 });
    }
    if (yesterday != null)
      rows.push({ reading_date: '2026-09-29', steps: yesterday });
    if (today != null) rows.push({ reading_date: TODAY, steps: today });
    return rows;
  }
  const run = (overrides = {}, stepsRows = steps({ yesterday: 22000 })) =>
    computeTarget({
      profile: { ...profile, ...overrides },
      latestWeight: weight,
      todayStr: TODAY,
      stepsRows,
    });

  it('is off by default and leaves the target untouched', () => {
    const off = run({ step_adjust_enabled: false });
    expect(off.stepAdjustment).toBeNull();
    const absent = run({ step_adjust_enabled: undefined });
    expect(absent.target).toBe(off.target);
  });

  it('credits only the deviation from usual, at the credited fraction', () => {
    const base = run({ step_adjust_enabled: false });
    const adj = run();
    // 10,000 steps over usual x ~0.0174 kcal/step x 0.5 = ~87 -> nearest 5
    expect(adj.stepAdjustment.status).toBe('applied');
    expect(adj.stepAdjustment.baselineSteps).toBe(12000);
    expect(adj.stepAdjustment.calories).toBe(85);
    expect(adj.target - base.target).toBe(85);
    expect(adj.maintenance).toBe(base.maintenance);
  });

  it('lowers the target after a below-usual day', () => {
    const base = run({ step_adjust_enabled: false });
    const lazy = run({}, steps({ yesterday: 4000 }));
    expect(lazy.stepAdjustment.calories).toBeLessThan(0);
    expect(lazy.target).toBeLessThan(base.target);
  });

  it('makes no adjustment when yesterday has no steps row', () => {
    const base = run({ step_adjust_enabled: false });
    const none = run({}, steps({}));
    expect(none.stepAdjustment.status).toBe('no_data');
    expect(none.stepAdjustment.calories).toBe(0);
    expect(none.target).toBe(base.target);
  });

  it('holds at zero until enough baseline days are logged', () => {
    const sparse = run({}, steps({ yesterday: 22000, baselineDays: 3 }));
    expect(sparse.stepAdjustment.status).toBe('pending');
    expect(sparse.stepAdjustment.calories).toBe(0);
  });

  it("never reads today's own steps", () => {
    const withoutToday = run({}, steps({ yesterday: 22000 }));
    const withToday = run({}, steps({ yesterday: 22000, today: 40000 }));
    expect(withToday.target).toBe(withoutToday.target);
    expect(withToday.stepAdjustment.calories).toBe(
      withoutToday.stepAdjustment.calories
    );
  });

  it('does not breach the safe floor, and a manual target wins', () => {
    // Goal tomorrow forces a clamp to the floor even with a step credit.
    const clamped = run(
      { goal_date: '2026-10-01' },
      steps({ yesterday: 4000 })
    );
    expect(clamped.clamped).toBe(true);
    expect(clamped.target).toBe(clamped.floor);

    const manual = run({ manual_target_cal: 1500 });
    expect(manual.target).toBe(1500);
    expect(manual.stepAdjustment).toBeNull();
  });
});

describe('steps → activity multiplier', () => {
  it.each([
    [0, 1.2],
    [4999, 1.2],
    [5000, 1.375],
    [7500, 1.55],
    [9999, 1.55],
    [10000, 1.62],
    [12500, 1.69],
    [15000, 1.76],
    [17500, 1.83],
    [19999, 1.83],
    [20000, 1.9],
    [20041, 1.9],
    [40000, 1.9],
  ])('maps %i steps/day to %f', (steps, expected) => {
    expect(stepsToActivityMultiplier(steps).multiplier).toBe(expected);
  });

  it('never decreases as steps rise', () => {
    let prev = 0;
    for (let s = 0; s <= 30000; s += 100) {
      const { multiplier } = stepsToActivityMultiplier(s);
      expect(multiplier).toBeGreaterThanOrEqual(prev);
      prev = multiplier;
    }
  });
});
