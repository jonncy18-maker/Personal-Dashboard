import { describe, expect, it } from 'vitest';
import { collapseMergedTrips } from './trip-merge';

const trip = (id, overrides = {}) => ({
  id,
  destination: id,
  start_date: null,
  end_date: null,
  merged_into_id: null,
  ...overrides,
});

describe('collapseMergedTrips', () => {
  it('folds a one-level leg into its root and widens the range', () => {
    const out = collapseMergedTrips([
      trip('A', { start_date: '2026-12-31', end_date: '2027-01-05' }),
      trip('B', {
        start_date: '2027-01-05',
        end_date: '2027-01-10',
        merged_into_id: 'A',
      }),
      trip('C', { start_date: '2027-03-01', end_date: '2027-03-04' }),
    ]);
    expect(out.map((t) => t.id)).toEqual(['A', 'C']);
    expect(out[0].is_merged).toBe(true);
    expect(out[0].legs.map((l) => l.id)).toEqual(['B']);
    expect(out[0].start_date).toBe('2026-12-31');
    expect(out[0].end_date).toBe('2027-01-10');
    expect(out[1].is_merged).toBe(false);
  });

  it('shows both trips when two trips point at each other', () => {
    const out = collapseMergedTrips([
      trip('A', { merged_into_id: 'B' }),
      trip('B', { merged_into_id: 'A' }),
    ]);
    expect(out.map((t) => t.id).sort()).toEqual(['A', 'B']);
    expect(out.every((t) => !t.is_merged)).toBe(true);
  });

  it('treats a leg whose parent is missing as a root', () => {
    const out = collapseMergedTrips([trip('B', { merged_into_id: 'gone' })]);
    expect(out.map((t) => t.id)).toEqual(['B']);
    expect(out[0].is_merged).toBe(false);
  });

  it('keeps a two-level chain visible instead of dropping trips', () => {
    const out = collapseMergedTrips([
      trip('A'),
      trip('B', { merged_into_id: 'A' }),
      trip('C', { merged_into_id: 'B' }),
    ]);
    expect(out.map((t) => t.id).sort()).toEqual(['A', 'C']);
  });
});
