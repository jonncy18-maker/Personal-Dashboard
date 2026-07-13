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
