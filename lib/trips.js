import { num, dateOnly } from './db';

// Shared trip row → API payload coercion (see lib/db.js): NUMERIC columns come
// back as strings and DATE columns as UTC-midnight instants, both of which
// must be normalized at the API boundary. Used by both /api/trips routes so
// the list and single-trip responses stay identical.
export function serializeTrip(row) {
  return {
    ...row,
    budget: num(row.budget),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    start_date: dateOnly(row.start_date),
    end_date: dateOnly(row.end_date),
  };
}
