const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date) {
  const d = new Date(date);
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
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', {
    weekday: opts.short === false ? undefined : 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function absoluteDateTime(dateInput) {
  const d = new Date(dateInput);
  const date = absoluteDate(d);
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function monthLabel(dateInput) {
  return new Date(dateInput).toLocaleDateString('en-US', { month: 'long' });
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
