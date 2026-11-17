import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';
import { deviceToday } from '../../../lib/device-time';
import { isValidDate } from '../../../lib/health';
import { weekdayOf } from '../../../lib/workouts';
import {
  compactOverview,
  loadExercises,
  loadLastSets,
  loadSchedule,
  loadSessions,
  loadTemplates,
  withSuggestions,
} from '../../../lib/workouts-data';

// Everything the Workouts page (and get_workouts over MCP) needs in one
// read: the profile, the exercise list, templates with "last time" and the
// progression suggestion per exercise, the weekly schedule, what is planned
// for `date`, any session still in progress, and recent history.

const RECENT_SESSIONS = 30;
// `?compact=1` (the MCP tool) trims the read to fit a tool result — see
// compactOverview().
const COMPACT_SESSIONS = 5;

export const GET = route(async (request) => {
  const sql = getDb();
  const query = new URL(request.url).searchParams;
  const param = query.get('date');
  const compact = query.get('compact') === '1';
  if (param && !isValidDate(param)) {
    return Response.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const date = param || (await deviceToday({ sql }));

  const [profileRows, exercises, templates, schedule, sessions] =
    await Promise.all([
      sql`SELECT goals, constraints, target_minutes FROM workout_profile WHERE id = 1`,
      loadExercises(sql),
      loadTemplates(sql),
      loadSchedule(sql),
      loadSessions(sql, {
        limit: compact ? COMPACT_SESSIONS : RECENT_SESSIONS,
      }),
    ]);

  const active = sessions.find((s) => s.status === 'in_progress') || null;
  const last = await loadLastSets(
    sql,
    exercises.map((e) => e.id),
    active?.id
  );
  const day = schedule.find((d) => d.weekday === weekdayOf(date)) || null;

  const overview = {
    date,
    profile: profileRows[0] || {
      goals: null,
      constraints: null,
      target_minutes: null,
    },
    exercises,
    templates: templates.map((t) => withSuggestions(t, last)),
    schedule,
    today: day,
    lastByExercise: last,
    activeSession: active,
    sessions,
  };
  return Response.json(compact ? compactOverview(overview) : overview);
});
