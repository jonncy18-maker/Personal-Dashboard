import { describe, expect, it } from 'vitest';
import {
  exerciseProgress,
  groupSets,
  normalizeSet,
  prefillSet,
  setVolume,
  suggestNext,
  summarizeSets,
  weekdayOf,
} from './workouts';

const set = (overrides = {}) => ({
  exercise_id: 'ex1',
  set_number: 1,
  weight_lb: 30,
  reps: 8,
  per_side: false,
  ...overrides,
});

describe('set validation', () => {
  it('keeps unknown weight, reps and per_side as null, never zero or false', () => {
    const { set: s } = normalizeSet({ exercise_id: 'ex1' });
    expect(s.weight_lb).toBeNull();
    expect(s.reps).toBeNull();
    expect(s.per_side).toBeNull();
  });

  it('rejects bad numbers and a non-boolean per_side', () => {
    expect(
      normalizeSet({ exercise_id: 'ex1', weight_lb: -5 }).error
    ).toBeTruthy();
    expect(normalizeSet({ exercise_id: 'ex1', reps: 7.5 }).error).toBeTruthy();
    expect(
      normalizeSet({ exercise_id: 'ex1', per_side: 'yes' }).error
    ).toBeTruthy();
    expect(normalizeSet({ weight_lb: 10 }).error).toBeTruthy();
  });
});

describe('volume', () => {
  it('doubles a confirmed per-side set and counts an unconfirmed one once', () => {
    expect(setVolume(set({ weight_lb: 10, reps: 8, per_side: true }))).toBe(
      160
    );
    expect(setVolume(set({ weight_lb: 10, reps: 8, per_side: null }))).toBe(80);
    expect(setVolume(set({ weight_lb: null }))).toBeNull();
  });

  it('sums sets with different weights and flags an incomplete total', () => {
    const sets = [
      set({ weight_lb: 35, set_number: 1 }),
      set({ weight_lb: 30, set_number: 2 }),
      set({ weight_lb: 30, set_number: 3 }),
      set({ weight_lb: 30, set_number: 4 }),
    ];
    const total = summarizeSets(sets);
    expect(total).toMatchObject({
      setCount: 4,
      reps: 32,
      volume: 1000,
      volumeComplete: true,
      topWeight: 35,
    });
    const partial = summarizeSets([...sets, set({ weight_lb: null })]);
    expect(partial.volume).toBe(1000);
    expect(partial.volumeComplete).toBe(false);
    expect(summarizeSets([]).volume).toBeNull();
  });
});

describe('grouping and progress', () => {
  it('groups by exercise in first-logged order with sets in number order', () => {
    const groups = groupSets([
      set({ exercise_id: 'a', set_number: 2 }),
      set({ exercise_id: 'b', set_number: 1 }),
      set({ exercise_id: 'a', set_number: 1 }),
    ]);
    expect(groups.map((g) => g.exercise_id)).toEqual(['a', 'b']);
    expect(groups[0].sets.map((s) => s.set_number)).toEqual([1, 2]);
  });

  it('returns one point per session, oldest first', () => {
    const points = exerciseProgress([
      set({ session_id: 's2', session_date: '2026-11-15', weight_lb: 65 }),
      set({ session_id: 's1', session_date: '2026-11-08', weight_lb: 60 }),
      set({
        session_id: 's2',
        session_date: '2026-11-15',
        weight_lb: 60,
        set_number: 2,
      }),
    ]);
    expect(points.map((p) => p.session_date)).toEqual([
      '2026-11-08',
      '2026-11-15',
    ]);
    expect(points[1].topWeight).toBe(65);
    expect(points[1].setCount).toBe(2);
  });
});

describe('progression suggestion', () => {
  const four = (reps) =>
    [1, 2, 3, 4].map((n) => set({ set_number: n, weight_lb: 60, reps }));

  it('has no verdict without history', () => {
    expect(suggestNext({ lastSets: [], targetSets: 3, repMax: 12 }).kind).toBe(
      'start'
    );
    expect(
      suggestNext({ lastSets: [set({ weight_lb: null })], repMax: 12 }).kind
    ).toBe('start');
  });

  it('holds the weight until every set reaches the top of the range', () => {
    expect(
      suggestNext({ lastSets: four(8), targetSets: 3, repMax: 12 })
    ).toEqual({
      kind: 'hold',
      weight: 60,
      repMax: 12,
    });
    const mixed = [
      ...four(12).slice(0, 3),
      set({ set_number: 4, weight_lb: 60, reps: 10 }),
    ];
    expect(
      suggestNext({ lastSets: mixed, targetSets: 3, repMax: 12 }).kind
    ).toBe('hold');
  });

  it('suggests an increase once every set is at the top of the range', () => {
    expect(
      suggestNext({ lastSets: four(12), targetSets: 3, repMax: 12 }).kind
    ).toBe('increase');
  });

  it('does not increase off fewer top-weight sets than prescribed', () => {
    const sets = [
      set({ weight_lb: 35, reps: 12 }),
      set({ set_number: 2, weight_lb: 30, reps: 12 }),
    ];
    expect(
      suggestNext({ lastSets: sets, targetSets: 3, repMax: 12 }).kind
    ).toBe('hold');
  });

  it('judges the weight most sets used, not one heavier opening set', () => {
    const sets = [
      set({ set_number: 1, weight_lb: 35 }),
      set({ set_number: 2, weight_lb: 30 }),
      set({ set_number: 3, weight_lb: 30 }),
      set({ set_number: 4, weight_lb: 30 }),
    ];
    expect(suggestNext({ lastSets: sets, targetSets: 4, repMax: 12 })).toEqual({
      kind: 'hold',
      weight: 30,
      repMax: 12,
    });
  });

  it('only repeats the weight when the template has no rep range', () => {
    expect(
      suggestNext({ lastSets: four(8), targetSets: 3, repMax: null })
    ).toEqual({
      kind: 'repeat',
      weight: 60,
    });
  });
});

describe('prefill and weekday', () => {
  it('copies the previous set of this session before last time', () => {
    expect(
      prefillSet({
        currentSets: [set({ weight_lb: 35 })],
        lastSets: [set({ weight_lb: 30 })],
      }).weight_lb
    ).toBe(35);
    expect(
      prefillSet({ currentSets: [], lastSets: [set({ weight_lb: 30 })] })
        .weight_lb
    ).toBe(30);
    expect(prefillSet({ currentSets: [], lastSets: [] })).toBeNull();
  });

  it('reads the weekday of a bare date without a timezone shift', () => {
    expect(weekdayOf('2026-11-15')).toBe(0);
    expect(weekdayOf('2026-11-16')).toBe(1);
  });
});
