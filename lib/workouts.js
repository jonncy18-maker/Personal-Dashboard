// Health › Workouts — the pure rules (see .claude/skills/workouts). No DB
// and no React in here, so the page, the API routes and the tests all read
// one definition of volume, "last time" and the progression suggestion.

export const EQUIPMENT = ['machine', 'cable', 'cardio', 'other'];
export const SESSION_STATUSES = ['in_progress', 'completed'];
export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Weekday (0 = Sunday) of a bare YYYY-MM-DD, built on UTC so the local
// offset can't roll the day back.
export function weekdayOf(dateStr) {
  return new Date(
    Date.UTC(
      Number(dateStr.slice(0, 4)),
      Number(dateStr.slice(5, 7)) - 1,
      Number(dateStr.slice(8, 10))
    )
  ).getUTCDay();
}

// Optional-number parsers for the API boundary. `null` = not given,
// `undefined` = given but invalid (the caller turns that into a 400).
export function parseOptionalNumber(value, { min = 0, integer = false } = {}) {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return undefined;
  if (integer && !Number.isInteger(n)) return undefined;
  return n;
}

// per_side is three-valued on purpose: true, false, or null for "not
// confirmed". Anything else is invalid.
export function parsePerSide(value) {
  if (value == null || value === '') return null;
  if (value === true || value === false) return value;
  return undefined;
}

// Validates one incoming set. Returns { set } or { error }.
export function normalizeSet(raw) {
  if (!raw || typeof raw !== 'object')
    return { error: 'set must be an object' };
  if (!raw.exercise_id || typeof raw.exercise_id !== 'string') {
    return { error: 'each set needs an exercise_id' };
  }
  const weight = parseOptionalNumber(raw.weight_lb);
  if (weight === undefined) {
    return { error: 'weight_lb must be a non-negative number' };
  }
  const reps = parseOptionalNumber(raw.reps, { integer: true });
  if (reps === undefined) {
    return { error: 'reps must be a non-negative whole number' };
  }
  const perSide = parsePerSide(raw.per_side);
  if (perSide === undefined) {
    return { error: 'per_side must be true, false or omitted' };
  }
  return {
    set: {
      exercise_id: raw.exercise_id,
      weight_lb: weight,
      reps,
      per_side: perSide,
      notes:
        typeof raw.notes === 'string' && raw.notes.trim()
          ? raw.notes.trim()
          : null,
    },
  };
}

// Volume of one set in lb. A per-side set was performed twice (once per
// limb). An unconfirmed per_side counts once — the smaller, safer claim —
// and a set missing weight or reps has no volume at all rather than zero.
export function setVolume(set) {
  if (set.weight_lb == null || set.reps == null) return null;
  return set.weight_lb * set.reps * (set.per_side === true ? 2 : 1);
}

// Groups a session's sets by exercise, in the order each exercise was first
// logged, sets in set_number order.
export function groupSets(sets) {
  const groups = new Map();
  for (const set of sets) {
    if (!groups.has(set.exercise_id)) {
      groups.set(set.exercise_id, {
        exercise_id: set.exercise_id,
        exercise_name: set.exercise_name,
        sets: [],
      });
    }
    groups.get(set.exercise_id).sets.push(set);
  }
  for (const group of groups.values()) {
    group.sets.sort((a, b) => a.set_number - b.set_number);
  }
  return [...groups.values()];
}

// Totals for a list of sets. `volume` only sums sets that carry both a
// weight and a rep count; `volumeComplete` says whether that was all of them.
export function summarizeSets(sets) {
  let reps = 0;
  let volume = 0;
  let counted = 0;
  let topWeight = null;
  for (const set of sets) {
    if (set.reps != null) reps += set.reps;
    const v = setVolume(set);
    if (v != null) {
      volume += v;
      counted += 1;
    }
    if (
      set.weight_lb != null &&
      (topWeight == null || set.weight_lb > topWeight)
    ) {
      topWeight = set.weight_lb;
    }
  }
  return {
    setCount: sets.length,
    reps,
    volume: counted > 0 ? volume : null,
    volumeComplete: sets.length > 0 && counted === sets.length,
    topWeight,
  };
}

// One point per session for an exercise's progress chart, oldest first.
// `rows` are that exercise's sets joined with session_date.
export function exerciseProgress(rows) {
  const bySession = new Map();
  for (const row of rows) {
    if (!bySession.has(row.session_id)) {
      bySession.set(row.session_id, {
        session_id: row.session_id,
        session_date: row.session_date,
        sets: [],
      });
    }
    bySession.get(row.session_id).sets.push(row);
  }
  return [...bySession.values()]
    .map((s) => {
      s.sets.sort((a, b) => a.set_number - b.set_number);
      return { ...s, ...summarizeSets(s.sets) };
    })
    .sort((a, b) => (a.session_date < b.session_date ? -1 : 1));
}

// The weight most of an exercise's sets were done at — the higher one on a
// tie. A single heavier opening set followed by a drop is not the working
// weight, so the top weight alone would mislead.
export function workingWeight(sets) {
  const counts = new Map();
  for (const s of sets) {
    counts.set(s.weight_lb, (counts.get(s.weight_lb) || 0) + 1);
  }
  let best = null;
  for (const [weight, count] of counts) {
    if (
      best == null ||
      count > best.count ||
      (count === best.count && weight > best.weight)
    ) {
      best = { weight, count };
    }
  }
  return best?.weight ?? null;
}

// The progression rule from John's own written plan: when every prescribed
// set reaches the top of the rep range, add the smallest increment;
// otherwise hold the weight and chase reps. It reads only the last logged
// session for the exercise and returns its inputs with the verdict, so the
// page can show its work. No history, or no rep range, means no verdict.
export function suggestNext({ lastSets, targetSets, repMax }) {
  const sets = (lastSets || []).filter(
    (s) => s.weight_lb != null && s.reps != null
  );
  if (sets.length === 0) return { kind: 'start' };

  const weight = workingWeight(sets);
  if (repMax == null) return { kind: 'repeat', weight };

  const atWeight = sets.filter((s) => s.weight_lb === weight);
  const enoughSets = targetSets == null || atWeight.length >= targetSets;
  const allAtTopOfRange = atWeight.every((s) => s.reps >= repMax);
  if (enoughSets && allAtTopOfRange) {
    return { kind: 'increase', weight, repMax };
  }
  return { kind: 'hold', weight, repMax };
}

// What to pre-fill for the next set: the previous set of this session if
// there is one, else the first set from last time. Null when there is
// nothing to copy.
export function prefillSet({ currentSets, lastSets }) {
  if (currentSets?.length) {
    const prev = currentSets[currentSets.length - 1];
    return {
      weight_lb: prev.weight_lb,
      reps: prev.reps,
      per_side: prev.per_side,
    };
  }
  if (lastSets?.length) {
    const first = lastSets[0];
    return {
      weight_lb: first.weight_lb,
      reps: first.reps,
      per_side: first.per_side,
    };
  }
  return null;
}
