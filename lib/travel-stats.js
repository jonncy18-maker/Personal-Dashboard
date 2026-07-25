import { dateOnly } from './db';

// Pure aggregation for the Travel Stats bar. Every number here comes straight
// from real trip rows — no fabricated totals (CLAUDE.md's hard rule). Points/
// miles are deliberately absent: they'd need a loyalty-account integration with
// no data source, so they're left out rather than invented.
//
// "Real trips" = status upcoming or past. Wishlist trips are aspirational, not
// travel that happened or is booked, so they're excluded from every tile. The
// framing is whole-log (past + upcoming), John's call — not past-only.

const REAL_STATUSES = new Set(['upcoming', 'past']);

// A cruise is detected by the word "cruise" in the destination or notes — the
// same signal lib/destination.js already treats as a generic trip-type word.
// Transparent heuristic, not a stored flag; there's no cruise column to key off.
export function isCruise(trip) {
  const hay = `${trip?.destination || ''} ${trip?.notes || ''}`.toLowerCase();
  return /\bcruise\b/.test(hay);
}

// Whole nights for a trip = end_date − start_date in days. Both are date-only
// columns (UTC-midnight instants), so compare them as day strings to avoid the
// negative-offset off-by-one that bit date displays before (ROADMAP 2026-07-15).
export function tripNights(trip) {
  const start = dateOnly(trip?.start_date);
  const end = dateOnly(trip?.end_date);
  if (!start || !end) return 0;
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(ms)) return 0;
  const nights = Math.round(ms / 86400000);
  return nights > 0 ? nights : 0;
}

export function computeTravelStats(rows) {
  const real = (rows || []).filter((r) => REAL_STATUSES.has(r.status));

  const countries = new Set();
  let nights = 0;
  let cruiseNights = 0;

  for (const trip of real) {
    const n = tripNights(trip);
    nights += n;
    if (isCruise(trip)) cruiseNights += n;
    if (trip.country) countries.add(trip.country.trim().toLowerCase());
  }

  return {
    trips: real.length,
    nights,
    countries: countries.size,
    cruiseNights,
  };
}
