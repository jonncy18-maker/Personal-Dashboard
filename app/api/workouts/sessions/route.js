import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { deviceToday } from '../../../../lib/device-time';
import { isValidDate } from '../../../../lib/health';
import {
  SESSION_STATUSES,
  parseOptionalNumber,
} from '../../../../lib/workouts';
import {
  insertSets,
  isUuid,
  loadSession,
  loadSessions,
  validateSets,
} from '../../../../lib/workouts-data';

const MAX_LIMIT = 100;

export const GET = route(async (request) => {
  const params = new URL(request.url).searchParams;
  const before = params.get('before');
  if (before && !isValidDate(before)) {
    return Response.json(
      { error: 'before must be YYYY-MM-DD' },
      { status: 400 }
    );
  }
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') || '20', 10) || 20, 1),
    MAX_LIMIT
  );
  const sessions = await loadSessions(getDb(), { limit, before });
  return Response.json({ sessions });
});

// Logs a session, optionally with its sets in the same call. `status:
// 'in_progress'` starts a live session the page then adds sets to.
export const POST = route(async (request) => {
  const body = await request.json();
  const sql = getDb();

  if (body.date != null && !isValidDate(body.date)) {
    return Response.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const status = body.status ?? 'completed';
  if (!SESSION_STATUSES.includes(status)) {
    return Response.json(
      { error: `status must be one of ${SESSION_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }
  if (
    body.details_complete != null &&
    typeof body.details_complete !== 'boolean'
  ) {
    return Response.json(
      { error: 'details_complete must be true or false' },
      { status: 400 }
    );
  }
  const duration = parseOptionalNumber(body.duration_min, {
    min: 1,
    integer: true,
  });
  if (duration === undefined) {
    return Response.json(
      { error: 'duration_min must be a positive whole number' },
      { status: 400 }
    );
  }

  let templateId = null;
  let name = (body.name || '').trim();
  if (body.template_id) {
    const [template] = isUuid(body.template_id)
      ? await sql`SELECT id, name FROM workout_templates WHERE id = ${body.template_id}`
      : [];
    if (!template) {
      return Response.json(
        { error: `unknown template_id: ${body.template_id}` },
        { status: 400 }
      );
    }
    templateId = template.id;
    name = name || template.name;
  }
  if (!name) {
    return Response.json(
      { error: 'name is required when no template_id is given' },
      { status: 400 }
    );
  }

  const { sets, error } = await validateSets(sql, body.sets || []);
  if (error) return Response.json({ error }, { status: 400 });

  if (status === 'in_progress') {
    const [open] = await sql`
      SELECT id FROM workout_sessions WHERE status = 'in_progress' LIMIT 1
    `;
    if (open) {
      return Response.json(
        { error: 'another session is already in progress', id: open.id },
        { status: 409 }
      );
    }
  }

  const date = body.date || (await deviceToday({ sql }));
  const [row] = await sql`
    INSERT INTO workout_sessions
      (session_date, name, template_id, status, details_complete,
       duration_min, notes, started_at)
    VALUES (${date}, ${name}, ${templateId}, ${status},
            ${body.details_complete ?? true}, ${duration},
            ${(body.notes || '').trim() || null},
            ${status === 'in_progress' ? new Date().toISOString() : null})
    RETURNING id
  `;
  await insertSets(sql, row.id, sets);
  return Response.json(
    { session: await loadSession(sql, row.id) },
    { status: 201 }
  );
});
