const DAY_MS = 24 * 60 * 60 * 1000;

// A bare "YYYY-MM-DD" — a calendar date with no time-of-day, e.g. a Schedules
// due_date or Travel start/end date (see lib/db.js's dateOnly()) — must NOT
// go through `new Date(string)`: the JS spec parses a date-only string as UTC
// midnight, and any subsequent local-timezone math (like the .setHours below)
// silently rolls it back a day for anyone west of UTC. Parse the Y-M-D
// components directly into local midnight instead. A full timestamp (e.g. a
// Language tutor call, which carries a real moment in time) still goes
// through the normal instant-aware `new Date()` path — that one *should*
// localize.
export function parseDateInput(dateInput) {
  if (typeof dateInput === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
    if (match) {
      const [, y, m, d] = match;
      return new Date(Number(y), Number(m) - 1, Number(d));
    }
  }
  return new Date(dateInput);
}

function startOfDay(date) {
  const d = parseDateInput(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// "Today", "In 5 days", "In 3 wks" — used by the Up Next agenda's relative-time rail.
export function relativeDay(dateInput, now = new Date()) {
  const target = startOfDay(dateInput);
  const today = startOfDay(now);
  const diffDays = Math.round((target - today) / DAY_MS);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 14) return `In ${diffDays} days`;
  if (diffDays >= 14 && diffDays < 60)
    return `In ${Math.round(diffDays / 7)} wks`;
  if (diffDays >= 60) return `In ${Math.round(diffDays / 30)} mos`;
  return target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function absoluteDate(dateInput, opts = {}) {
  const d = parseDateInput(dateInput);
  return d.toLocaleDateString('en-US', {
    weekday: opts.short === false ? undefined : 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function absoluteDateTime(dateInput) {
  const d = parseDateInput(dateInput);
  const date = absoluteDate(d);
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function monthLabel(dateInput) {
  return parseDateInput(dateInput).toLocaleDateString('en-US', {
    month: 'long',
  });
}

export function daysUntil(dateInput, now = new Date()) {
  return Math.max(
    0,
    Math.round((startOfDay(dateInput) - startOfDay(now)) / DAY_MS)
  );
}

export function timeOfDayGreeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 22) return 'Good evening';
  return 'Working late';
}
