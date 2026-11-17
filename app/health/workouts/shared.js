// Small client helpers shared by the Workouts page's sections.

// One JSON call to this app's own API. A non-2xx body is an error payload,
// never data, so it is thrown with the server's message.
export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

export function fmtWeight(value) {
  if (value == null) return '—';
  return Number.isInteger(value) ? String(value) : String(+value.toFixed(2));
}

// "Sun, Nov 15" from a bare YYYY-MM-DD, built on UTC so the day can't shift.
export function fmtDate(dateStr, opts = {}) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...opts,
  });
}

// "60 × 8" for one set; the per-side mark only when it was confirmed.
export function fmtSet(set) {
  const side = set.per_side === true ? ' /side' : '';
  return `${fmtWeight(set.weight_lb)} × ${set.reps ?? '—'}${side}`;
}

export function fmtTarget(item) {
  if (!item.target_sets && !item.rep_max && !item.rep_min) return null;
  const reps =
    item.rep_min && item.rep_max && item.rep_min !== item.rep_max
      ? `${item.rep_min}–${item.rep_max}`
      : item.rep_max || item.rep_min;
  if (!item.target_sets) return `${reps} reps`;
  return reps ? `${item.target_sets} × ${reps}` : `${item.target_sets} sets`;
}

// The rule-based suggestion as one line. It restates the rule so the
// verdict is never a bare instruction.
export function suggestionText(s) {
  if (!s) return null;
  switch (s.kind) {
    case 'increase':
      return `Every set hit ${s.repMax} reps at ${fmtWeight(s.weight)} lb — try the next weight up.`;
    case 'hold':
      return `Stay at ${fmtWeight(s.weight)} lb until every set reaches ${s.repMax} reps.`;
    case 'repeat':
      return `Last time: ${fmtWeight(s.weight)} lb.`;
    default:
      return 'No history yet — start light and find a controlled weight.';
  }
}
