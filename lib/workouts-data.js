import { dateOnly, num } from './db';
import {
  groupSets,
  normalizeSet,
  summarizeSets,
  suggestNext,
} from './workouts';

// Server-side reads and writes shared by the app/api/workouts/* routes. The
// pure rules live in lib/workouts.js; this file only fetches and shapes rows.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id would otherwise reach Postgres and come back as a 500.
export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

export function shapeSet(row) {
  return { ...row, weight_lb: num(row.weight_lb) };
}

export function shapeSession(row, sets = []) {
  const shaped = sets.map(shapeSet);
  return {
    ...row,
    session_date: dateOnly(row.session_date),
    // Sets are trimmed to what a reader needs (the group already names the
    // exercise) so a long history fits an MCP tool result. A null per_side
    // or note is left out; absent reads the same as null.
    exercises: groupSets(shaped).map((g) => ({
      ...g,
      ...summarizeSets(g.sets),
      sets: g.sets.map((set) => ({
        id: set.id,
        set_number: set.set_number,
        weight_lb: set.weight_lb,
        reps: set.reps,
        ...(set.per_side != null ? { per_side: set.per_side } : {}),
        ...(set.notes ? { notes: set.notes } : {}),
      })),
    })),
    totals: summarizeSets(shaped),
  };
}

export async function loadSets(sql, sessionIds) {
  if (sessionIds.length === 0) return [];
  return sql`
    SELECT s.id, s.session_id, s.exercise_id, e.name AS exercise_name,
           s.set_number, s.weight_lb, s.reps, s.per_side, s.notes, s.created_at
    FROM workout_sets s
    JOIN workout_exercises e ON e.id = s.exercise_id
    WHERE s.session_id = ANY(${sessionIds}::uuid[])
    ORDER BY s.created_at, s.set_number
  `;
}

export async function loadSessions(sql, { limit = 20, before = null } = {}) {
  const rows = await sql`
    SELECT * FROM workout_sessions
    WHERE (${before}::date IS NULL OR session_date < ${before}::date)
    ORDER BY session_date DESC, created_at DESC
    LIMIT ${limit}
  `;
  const sets = await loadSets(
    sql,
    rows.map((r) => r.id)
  );
  return rows.map((row) =>
    shapeSession(
      row,
      sets.filter((s) => s.session_id === row.id)
    )
  );
}

export async function loadSession(sql, id) {
  const [row] = await sql`SELECT * FROM workout_sessions WHERE id = ${id}`;
  if (!row) return null;
  return shapeSession(row, await loadSets(sql, [id]));
}

export async function loadExercises(sql) {
  return sql`
    SELECT id, name, equipment, muscle_group, unilateral, notes, archived_at
    FROM workout_exercises
    ORDER BY archived_at IS NOT NULL, lower(name)
  `;
}

export async function loadTemplates(sql) {
  const templates = await sql`
    SELECT id, name, focus, notes, sort_order
    FROM workout_templates
    ORDER BY sort_order, created_at
  `;
  const items = await sql`
    SELECT te.id, te.template_id, te.exercise_id, e.name AS exercise_name,
           e.equipment, e.unilateral, te.position, te.target_sets,
           te.rep_min, te.rep_max, te.notes
    FROM workout_template_exercises te
    JOIN workout_exercises e ON e.id = te.exercise_id
    ORDER BY te.position
  `;
  return templates.map((t) => ({
    ...t,
    exercises: items.filter((i) => i.template_id === t.id),
  }));
}

export async function loadSchedule(sql) {
  return sql`
    SELECT s.weekday, s.template_id, s.label, t.name AS template_name
    FROM workout_schedule s
    LEFT JOIN workout_templates t ON t.id = s.template_id
    ORDER BY s.weekday
  `;
}

// For each exercise, the sets of the most recent COMPLETED session that
// logged it, before `excludeSessionId` if one is open. This is "last time".
export async function loadLastSets(sql, exerciseIds, excludeSessionId = null) {
  if (exerciseIds.length === 0) return {};
  const rows = await sql`
    SELECT st.exercise_id, st.set_number, st.weight_lb, st.reps, st.per_side,
           se.id AS session_id, se.session_date
    FROM workout_sets st
    JOIN workout_sessions se ON se.id = st.session_id
    JOIN (
      SELECT DISTINCT ON (st2.exercise_id) st2.exercise_id, se2.id AS session_id
      FROM workout_sets st2
      JOIN workout_sessions se2 ON se2.id = st2.session_id
      WHERE st2.exercise_id = ANY(${exerciseIds}::uuid[])
        AND se2.status = 'completed'
        AND (${excludeSessionId}::uuid IS NULL OR se2.id <> ${excludeSessionId}::uuid)
      ORDER BY st2.exercise_id, se2.session_date DESC, se2.created_at DESC
    ) latest ON latest.exercise_id = st.exercise_id
            AND latest.session_id = se.id
    ORDER BY st.exercise_id, st.set_number
  `;
  const out = {};
  for (const row of rows) {
    const key = row.exercise_id;
    if (!out[key]) {
      out[key] = {
        session_id: row.session_id,
        session_date: dateOnly(row.session_date),
        sets: [],
      };
    }
    out[key].sets.push({
      set_number: row.set_number,
      weight_lb: num(row.weight_lb),
      reps: row.reps,
      per_side: row.per_side,
    });
  }
  return out;
}

// Attaches "last time" and the progression suggestion to a template's
// exercises — the plan card the page and get_workouts both show.
export function withSuggestions(template, lastByExercise) {
  return {
    ...template,
    exercises: template.exercises.map((item) => {
      const last = lastByExercise[item.exercise_id] || null;
      return {
        ...item,
        last,
        suggestion: suggestNext({
          lastSets: last?.sets,
          targetSets: item.target_sets,
          repMax: item.rep_max,
        }),
      };
    }),
  };
}

// Validates incoming sets and checks every exercise_id exists. Returns
// { sets } or { error }.
export async function validateSets(sql, rawSets) {
  if (!Array.isArray(rawSets)) return { error: 'sets must be an array' };
  const sets = [];
  for (const raw of rawSets) {
    const { set, error } = normalizeSet(raw);
    if (error) return { error };
    if (!isUuid(set.exercise_id)) {
      return { error: `unknown exercise_id: ${set.exercise_id}` };
    }
    sets.push(set);
  }
  const ids = [...new Set(sets.map((s) => s.exercise_id))];
  if (ids.length > 0) {
    const found = await sql`
      SELECT id FROM workout_exercises WHERE id = ANY(${ids}::uuid[])
    `;
    const known = new Set(found.map((r) => r.id));
    const missing = ids.find((id) => !known.has(id));
    if (missing) return { error: `unknown exercise_id: ${missing}` };
  }
  return { sets };
}

// Appends validated sets to a session, numbering each after the sets that
// exercise already has there.
export async function insertSets(sql, sessionId, sets) {
  if (sets.length === 0) return;
  const existing = await sql`
    SELECT exercise_id, max(set_number) AS n
    FROM workout_sets WHERE session_id = ${sessionId}
    GROUP BY exercise_id
  `;
  const next = new Map(existing.map((r) => [r.exercise_id, Number(r.n)]));
  // clock_timestamp(), not the default now(): every insert in this
  // transaction would otherwise share one created_at and lose its order.
  const writes = sets.map((set) => {
    const n = (next.get(set.exercise_id) || 0) + 1;
    next.set(set.exercise_id, n);
    return sql`
      INSERT INTO workout_sets
        (session_id, exercise_id, set_number, weight_lb, reps, per_side, notes,
         created_at)
      VALUES (${sessionId}, ${set.exercise_id}, ${n}, ${set.weight_lb},
              ${set.reps}, ${set.per_side}, ${set.notes}, clock_timestamp())
    `;
  });
  await sql.transaction(writes);
}

// Validates a template's exercise list. Returns { items } or { error }.
export async function validateTemplateItems(sql, raw) {
  if (!Array.isArray(raw)) return { error: 'exercises must be an array' };
  const items = [];
  for (const r of raw) {
    if (!isUuid(r?.exercise_id)) {
      return { error: 'each template exercise needs a valid exercise_id' };
    }
    const ints = {};
    for (const key of ['target_sets', 'rep_min', 'rep_max']) {
      const v = r[key];
      if (v == null || v === '') {
        ints[key] = null;
      } else if (Number.isInteger(Number(v)) && Number(v) > 0) {
        ints[key] = Number(v);
      } else {
        return { error: `${key} must be a positive whole number` };
      }
    }
    if (
      ints.rep_min != null &&
      ints.rep_max != null &&
      ints.rep_min > ints.rep_max
    ) {
      return { error: 'rep_min cannot be above rep_max' };
    }
    items.push({
      exercise_id: r.exercise_id,
      ...ints,
      notes:
        typeof r.notes === 'string' && r.notes.trim() ? r.notes.trim() : null,
    });
  }
  const ids = [...new Set(items.map((i) => i.exercise_id))];
  if (ids.length > 0) {
    const found = await sql`
      SELECT id FROM workout_exercises WHERE id = ANY(${ids}::uuid[])
    `;
    if (found.length !== ids.length) {
      return { error: 'a template exercise_id does not exist' };
    }
  }
  return { items };
}

// Replaces a template's whole exercise list in one transaction.
export async function replaceTemplateItems(sql, templateId, items) {
  await sql.transaction([
    sql`DELETE FROM workout_template_exercises WHERE template_id = ${templateId}`,
    ...items.map(
      (item, index) => sql`
        INSERT INTO workout_template_exercises
          (template_id, exercise_id, position, target_sets, rep_min, rep_max, notes)
        VALUES (${templateId}, ${item.exercise_id}, ${index + 1},
                ${item.target_sets}, ${item.rep_min}, ${item.rep_max}, ${item.notes})
      `
    ),
  ]);
}

// "60x8, 60x8/side" — one line per exercise for the compact (MCP) read.
function setsLine(sets) {
  return sets
    .map(
      (s) =>
        `${s.weight_lb ?? '?'}x${s.reps ?? '?'}${s.per_side === true ? '/side' : ''}`
    )
    .join(', ');
}

// The overview trimmed to fit an MCP tool result: sets become one line per
// exercise and ids that no tool takes are dropped. Set ids, needed only to
// correct a set, come from the sessions list instead.
export function compactOverview(overview) {
  const { lastByExercise, activeSession, ...rest } = overview;
  return {
    ...rest,
    exercises: overview.exercises.map((e) => ({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      muscle_group: e.muscle_group,
      unilateral: e.unilateral,
      ...(e.archived_at ? { archived: true } : {}),
    })),
    templates: overview.templates.map((t) => ({
      id: t.id,
      name: t.name,
      focus: t.focus,
      ...(t.notes ? { notes: t.notes } : {}),
      exercises: t.exercises.map((i) => ({
        exercise_id: i.exercise_id,
        exercise_name: i.exercise_name,
        target_sets: i.target_sets,
        rep_min: i.rep_min,
        rep_max: i.rep_max,
        ...(i.notes ? { notes: i.notes } : {}),
        last: i.last && {
          session_date: i.last.session_date,
          sets: setsLine(i.last.sets),
        },
        suggestion: i.suggestion,
      })),
    })),
    activeSessionId: activeSession?.id ?? null,
    sessions: overview.sessions.map((s) => ({
      id: s.id,
      session_date: s.session_date,
      name: s.name,
      status: s.status,
      details_complete: s.details_complete,
      duration_min: s.duration_min,
      ...(s.notes ? { notes: s.notes } : {}),
      exercises: s.exercises.map((g) => ({
        exercise_name: g.exercise_name,
        sets: setsLine(g.sets),
      })),
      totals: s.totals,
    })),
  };
}
