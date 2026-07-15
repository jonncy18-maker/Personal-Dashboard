import { neon } from '@neondatabase/serverless';

// Vercel+Neon integration auto-creates DATABASE_URL; NEON_DATABASE_URL is the
// manual override if the DB is provisioned outside the integration.
export function getDb() {
  return neon(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL);
}

// Numeric-string coercion (see STACK_BLUEPRINT.md Part 2): the Neon serverless
// driver returns NUMERIC/DECIMAL columns as STRINGS to avoid precision loss.
// Coerce at the API boundary, never in a component, or .toFixed()/arithmetic
// silently breaks. Use this on any money/duration field (e.g. Travel budget).
export function num(value) {
  return value == null ? value : Number(value);
}

// DATE columns (Travel start/end, Schedules due_date) come back as a JS Date
// fixed at UTC midnight for the stored calendar day. Left as-is, Response.json
// serializes that to "...T00:00:00.000Z" — and any later `new Date(...)` +
// local-timezone math (lib/format.js) silently rolls the day back by one for
// any negative UTC offset (all of the US: "July 16" becomes 8pm "July 15").
// Coerce to a bare "YYYY-MM-DD" string at the API boundary so nothing
// downstream can misread it as a real instant.
export function dateOnly(value) {
  if (value == null) return value;
  const iso = value instanceof Date ? value.toISOString() : String(value);
  return iso.slice(0, 10);
}
