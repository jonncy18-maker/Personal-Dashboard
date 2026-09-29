import { describe, expect, it } from 'vitest';
import {
  dayTotals,
  fiberProgress,
  SATURATED_FAT_MIN_CALORIE_COVERAGE,
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

    const zero = dayTotals([entry({ fiber_g: 0, saturated_fat_g: 0 })]);
    expect(zero.fiberG).toBe(0);
    expect(zero.fiberComplete).toBe(true);
    expect(zero.saturatedFatG).toBe(0);
    expect(zero.saturatedFatStatus).toBe('green');
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
      }),
    ]);
    expect(totals.total).toBe(35);
    expect(totals.fiberG).toBe(2);
    expect(totals.estimated).toBe(false);
    expect(totals.veggieServings).toBe(0);
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
