// Generic, unattributed lines for the Home hero (John's call: no personal
// byline — nothing put in his mouth). Rotates once a day, stable within a day
// so it doesn't flicker between renders.

export const QUOTES = [
  'Small, steady steps compound into everything.',
  'Do the quiet work today.',
  'Momentum is built, not found.',
  'One honest hour beats a busy day.',
  'Start before you feel ready.',
  'Consistency outlasts intensity.',
  'Progress is built in the small, daily choices.',
  'Finish one thing well.',
];

export function quoteForDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}
