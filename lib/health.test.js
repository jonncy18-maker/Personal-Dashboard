import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MULTIPLIER_CAP,
  addDays,
  computeTarget,
  dayTotals,
  empiricalMaintenance,
  isValidDate,
  normalizeModeFields,
  fiberProgress,
  fruitProgress,
  SATURATED_FAT_MIN_CALORIE_COVERAGE,
  stepsToActivityMultiplier,
  weightBasis,
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

describe('activity multiplier cap (steps_trailing only)', () => {
  const TODAY = '2026-10-13';
  const profile = {
    sex: 'male',
    birth_date: '1993-12-10',
    height_in: 62,
    activity_multiplier: 1.75,
    activity_source: 'steps_trailing',
    activity_trailing_days: 14,
    floor_pct: 0.6,
    goal_weight_lb: 114,
    goal_date: '2026-10-28',
  };
  const weight = { reading_date: TODAY, weight_lb: 116.1 };
  const flat = (steps) =>
    Array.from({ length: 14 }, (_, i) => ({
      reading_date: addDays(TODAY, -i),
      steps,
    }));
  const run = (overrides = {}, stepsRows = flat(20000)) =>
    computeTarget({
      profile: { ...profile, ...overrides },
      latestWeight: weight,
      todayStr: TODAY,
      stepsRows,
    });

  it('caps a high steps-derived multiplier and says so', () => {
    const t = run();
    expect(ACTIVITY_MULTIPLIER_CAP).toBe(1.7);
    expect(t.activityMultiplier).toBe(1.7);
    expect(t.activityCapped).toBe(true);
    expect(t.activityUncappedMultiplier).toBe(1.9);
    expect(t.maintenance).toBe(Math.round(t.bmr * 1.7));
  });

  it('leaves lower step averages uncapped and still ordered', () => {
    const t = run({}, flat(12000));
    expect(t.activityMultiplier).toBe(1.62);
    expect(t.activityCapped).toBe(false);
    expect(run({}, flat(8000)).activityMultiplier).toBeLessThan(
      t.activityMultiplier
    );
  });

  it('never touches the manual multiplier or the pending fallback', () => {
    const manual = run({ activity_source: 'manual', activity_multiplier: 1.9 });
    expect(manual.activityMultiplier).toBe(1.9);
    expect(manual.activityCapped).toBe(false);
    const pending = run({ activity_multiplier: 1.9 }, flat(20000).slice(0, 3));
    expect(pending.activityProvenance).toBe('steps_trailing_pending');
    expect(pending.activityMultiplier).toBe(1.9);
    expect(pending.activityCapped).toBe(false);
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

describe('empirical maintenance', () => {
  const TODAY = '2026-10-13';
  const days = (n) =>
    Array.from({ length: n }, (_, i) => addDays(TODAY, -(i + 1))).reverse();
  it('is avg intake plus the implied deficit, and null on thin data', () => {
    const ds = days(20);
    // 2,000/day logged, 2 lb lost over the span -> + 2*3500/span
    const intakeRows = ds.map((d) => ({ entry_date: d, total: 2000 }));
    const weightRows = ds.map((d, i) => ({
      reading_date: d,
      weight_lb: 120 - (i * 2) / 19,
    }));
    const e = empiricalMaintenance({ intakeRows, weightRows, todayStr: TODAY });
    expect(e.avgIntake).toBe(2000);
    expect(e.maintenance).toBeGreaterThan(2300);
    expect(e.maintenance).toBeLessThan(2500);
    expect(
      empiricalMaintenance({
        intakeRows,
        weightRows: weightRows.slice(0, 3),
        todayStr: TODAY,
      })
    ).toBeNull();
    expect(
      empiricalMaintenance({
        intakeRows: intakeRows.slice(0, 4),
        weightRows,
        todayStr: TODAY,
      })
    ).toBeNull();
  });
});

describe('weightBasis (trailing 7-day weight)', () => {
  const rows = [
    { reading_date: '2026-10-08', weight_lb: 130 },
    { reading_date: '2026-10-10', weight_lb: 128 },
    { reading_date: '2026-10-12', weight_lb: null, steps: 9000 },
    { reading_date: '2026-10-14', weight_lb: 126 },
    { reading_date: '2026-10-16', weight_lb: 100 },
  ];

  it('averages only readings inside the window, ignoring null and future rows', () => {
    const b = weightBasis(rows, '2026-10-14');
    // window 10-08..10-14 -> 130, 128, 126: mean 128, latest 126
    expect(b.meanLb).toBe(128);
    expect(b.daysAveraged).toBe(3);
    expect(b.reading_date).toBe('2026-10-14');
  });

  it('excludes readings older than 7 calendar days', () => {
    const b = weightBasis(rows, '2026-10-15');
    // window 10-09..10-15 -> 128 and 126
    expect(b.meanLb).toBe(127);
    expect(b.daysAveraged).toBe(2);
  });

  it('uses the lower of the mean and the latest reading', () => {
    // Falling: the latest reading beats the lagging mean.
    const falling = weightBasis(rows, '2026-10-14');
    expect(falling.basis).toBe('latest');
    expect(falling.weight_lb).toBe(126);
    expect(falling.meanLb).toBe(128);
  });

  it('lets the mean dampen a sore, water-heavy spike', () => {
    const spike = [
      { reading_date: '2026-10-12', weight_lb: 116 },
      { reading_date: '2026-10-13', weight_lb: 116 },
      { reading_date: '2026-10-14', weight_lb: 118 },
    ];
    const b = weightBasis(spike, '2026-10-14');
    expect(b.basis).toBe('mean');
    expect(b.latestLb).toBe(118);
    expect(b.weight_lb).toBeCloseTo(116.667, 3);
  });

  it('feeds the lower weight into computeTarget and reports which it was', () => {
    const profile = {
      sex: 'male',
      birth_date: '1993-12-10',
      height_in: 62,
      activity_multiplier: 1.7,
      mode: 'maintain',
    };
    const fall = [
      { reading_date: '2026-10-17', weight_lb: 117.5 },
      { reading_date: '2026-10-18', weight_lb: 116 },
      { reading_date: '2026-10-19', weight_lb: 114.6 },
    ];
    const t = computeTarget({
      profile,
      latestWeight: weightBasis(fall, '2026-10-19'),
      todayStr: '2026-10-19',
      stepsRows: [],
    });
    expect(t.weightLb).toBe(114.6);
    expect(t.weightBasis).toBe('latest');
    expect(t.weightMeanLb).toBeCloseTo(116.033, 3);
  });

  it('falls back to the latest earlier reading when the window is empty', () => {
    const b = weightBasis(rows, '2026-10-30');
    expect(b).toMatchObject({
      reading_date: '2026-10-16',
      weight_lb: 100,
      daysAveraged: 1,
    });
  });

  it('is null with no reading on or before the day', () => {
    expect(weightBasis(rows, '2026-10-01')).toBeNull();
    expect(weightBasis([], '2026-10-01')).toBeNull();
  });
});

describe('food modes', () => {
  const TODAY = '2026-10-19';
  const base = {
    sex: 'male',
    birth_date: '1993-12-10',
    height_in: 62,
    activity_multiplier: 1.7,
    activity_source: 'manual',
    floor_pct: 0.6,
    goal_weight_lb: 114,
    goal_date: '2026-10-28',
    max_loss_pct_per_week: 1,
  };
  const weight = { reading_date: TODAY, weight_lb: 116.2, daysAveraged: 7 };
  const run = (profile) =>
    computeTarget({
      profile: { ...base, ...profile },
      latestWeight: weight,
      todayStr: TODAY,
      stepsRows: [],
    });

  describe('cut', () => {
    it('is the default mode', () => {
      expect(run({}).mode).toBe('cut');
    });

    it('slips the date instead of taking an extreme deficit', () => {
      // 2.2 lb in 9 days wants ~850 kcal/day; 1%/week of 116.2 lb is ~581.
      const uncapped = run({ max_loss_pct_per_week: null });
      expect(uncapped.deficit).toBeGreaterThan(800);
      expect(uncapped.rateCapped).toBe(false);

      const capped = run({});
      expect(capped.rateCapped).toBe(true);
      expect(capped.deficit).toBe(581);
      expect(capped.target).toBe(capped.maintenance - 581);
      expect(capped.projectedDate > '2026-10-28').toBe(true);
      expect(capped.clamped).toBe(false);
    });

    it('does not cap a goal that is already gentle enough', () => {
      const r = run({ goal_date: '2026-12-31' });
      expect(r.rateCapped).toBe(false);
      expect(r.projectedDate).toBeNull();
    });
  });

  describe('maintain', () => {
    it('targets a band around a stated maintenance', () => {
      const r = run({
        mode: 'maintain',
        maintain_cal_manual: 2300,
        maintain_band_pct: 5,
      });
      expect(r.target).toBe(2300);
      expect(r.targetLow).toBe(2185);
      expect(r.targetHigh).toBe(2415);
      expect(r.deficit).toBe(0);
      expect(r.provenance).toBe('maintain_manual');
    });

    it('uses the formula when no maintenance is stated', () => {
      const r = run({ mode: 'maintain', maintain_band_pct: 10 });
      expect(r.target).toBe(r.maintenance);
      expect(r.targetLow).toBe(Math.round(r.maintenance * 0.9));
      expect(r.provenance).toBe('formula');
    });

    it('ignores the goal weight and date entirely', () => {
      const r = run({ mode: 'maintain', maintain_cal_manual: 2300 });
      expect(r.requiredRatePerWeek).toBeNull();
      expect(r.rateCapped).toBe(false);
    });

    it('works from a stated maintenance with no body stats', () => {
      const r = computeTarget({
        profile: { mode: 'maintain', maintain_cal_manual: 2300 },
        latestWeight: null,
        todayStr: TODAY,
        stepsRows: [],
      });
      expect(r.target).toBe(2300);
      expect(r.missing).toEqual([]);
    });

    it('reports the 7-day mean against the maintenance weight', () => {
      const r = run({ mode: 'maintain', maintain_weight_lb: 115 });
      expect(r.weightVsSetPoint).toBe(1.2);
    });

    it('runs the band down only or up only', () => {
      const down = run({
        mode: 'maintain',
        maintain_cal_manual: 2300,
        maintain_band_pct: 5,
        maintain_band_dir: 'down',
      });
      expect([down.targetLow, down.targetHigh]).toEqual([2185, 2300]);
      const up = run({
        mode: 'maintain',
        maintain_cal_manual: 2300,
        maintain_band_pct: 5,
        maintain_band_dir: 'up',
      });
      expect([up.targetLow, up.targetHigh]).toEqual([2300, 2415]);
    });

    it('never lets a stored band exceed the hard cap', () => {
      const r = run({
        mode: 'maintain',
        maintain_cal_manual: 2000,
        maintain_band_pct: 25,
      });
      expect([r.targetLow, r.targetHigh]).toEqual([1800, 2200]);
    });
  });

  describe('build', () => {
    it('adds a surplus and sets a protein target from weight', () => {
      const cut = run({ max_loss_pct_per_week: null });
      const r = run({ mode: 'build', build_surplus_pct: 10 });
      expect(r.surplus).toBe(Math.round(r.maintenance * 0.1));
      expect(r.target).toBe(r.maintenance + r.surplus);
      expect(r.maintenance).toBe(cut.maintenance);
      expect(r.proteinTargetG).toBe(Math.round(0.8 * 116.2));
      expect(r.surplusCapped).toBe(false);
    });

    it('holds the surplus under the gain-rate cap', () => {
      const r = run({
        mode: 'build',
        build_surplus_pct: 30,
        max_gain_pct_per_week: 0.5,
      });
      // 0.5% of 116.2 lb a week = 0.581 lb = 290.5 kcal/day.
      expect(r.surplus).toBe(291);
      expect(r.surplusCapped).toBe(true);
    });

    it('lets the cap be switched off', () => {
      const r = run({
        mode: 'build',
        build_surplus_pct: 30,
        max_gain_pct_per_week: null,
      });
      expect(r.surplus).toBe(Math.round(r.maintenance * 0.3));
    });
  });

  it('still lets a manual target win in every mode', () => {
    for (const mode of ['cut', 'maintain', 'build']) {
      const r = run({ mode, manual_target_cal: 1800 });
      expect(r.target).toBe(1800);
      expect(r.provenance).toBe('manual');
    }
  });

  describe('normalizeModeFields', () => {
    it('resets NOT NULL fields to defaults and keeps nullable ones null', () => {
      const patch = {
        mode: null,
        maintain_band_pct: null,
        max_loss_pct_per_week: null,
      };
      expect(normalizeModeFields(patch)).toBeNull();
      expect(patch.mode).toBe('cut');
      expect(patch.maintain_band_pct).toBe(5);
      expect(patch.max_loss_pct_per_week).toBeNull();
    });

    it('rejects out-of-range values and unknown modes', () => {
      expect(normalizeModeFields({ mode: 'bulk' })).toMatch(/mode must be/);
      expect(normalizeModeFields({ maintain_band_pct: 11 })).toMatch(
        /at most 10/
      );
      expect(normalizeModeFields({ build_surplus_pct: 0 })).toMatch(/above 0/);
      expect(normalizeModeFields({ max_loss_pct_per_week: -1 })).toMatch(
        /above 0/
      );
    });

    it('rejects an unknown band direction and defaults a blank one', () => {
      expect(normalizeModeFields({ maintain_band_dir: 'sideways' })).toMatch(
        /maintain_band_dir/
      );
      const patch = { maintain_band_dir: null };
      expect(normalizeModeFields(patch)).toBeNull();
      expect(patch.maintain_band_dir).toBe('both');
    });

    it('allows a zero-width band and rounds stated maintenance', () => {
      const patch = { maintain_band_pct: 0, maintain_cal_manual: 2300.4 };
      expect(normalizeModeFields(patch)).toBeNull();
      expect(patch.maintain_cal_manual).toBe(2300);
    });
  });
});
