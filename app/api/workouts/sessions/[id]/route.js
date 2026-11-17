import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import { isValidDate } from '../../../../../lib/health';
import {
  SESSION_STATUSES,
  parseOptionalNumber,
} from '../../../../../lib/workouts';
import { isUuid, loadSession } from '../../../../../lib/workouts-data';

const notFound = () =>
  Response.json({ error: 'session not found' }, { status: 404 });

export const GET = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const session = await loadSession(getDb(), id);
  if (!session) return notFound();
  return Response.json({ session });
});

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await request.json();
  const sql = getDb();
  const [current] = await sql`SELECT * FROM workout_sessions WHERE id = ${id}`;
  if (!current) return notFound();

  const next = { ...current };
  if ('name' in body) {
    next.name = (body.name || '').trim();
    if (!next.name) {
      return Response.json({ error: 'name cannot be blank' }, { status: 400 });
    }
  }
  if ('date' in body) {
    if (!isValidDate(body.date)) {
      return Response.json(
        { error: 'date must be YYYY-MM-DD' },
        { status: 400 }
      );
    }
    next.session_date = body.date;
  }
  if ('status' in body) {
    if (!SESSION_STATUSES.includes(body.status)) {
      return Response.json(
        { error: `status must be one of ${SESSION_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    if (body.status === 'completed' && current.status === 'in_progress') {
      next.completed_at = new Date().toISOString();
    }
    next.status = body.status;
  }
  if ('details_complete' in body) {
    if (typeof body.details_complete !== 'boolean') {
      return Response.json(
        { error: 'details_complete must be true or false' },
        { status: 400 }
      );
    }
    next.details_complete = body.details_complete;
  }
  if ('duration_min' in body) {
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
    next.duration_min = duration;
  }
  if ('notes' in body) next.notes = (body.notes || '').trim() || null;

  await sql`
    UPDATE workout_sessions SET
      name = ${next.name}, session_date = ${next.session_date},
      status = ${next.status}, details_complete = ${next.details_complete},
      duration_min = ${next.duration_min}, notes = ${next.notes},
      completed_at = ${next.completed_at}
    WHERE id = ${id}
  `;
  return Response.json({ session: await loadSession(sql, id) });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM workout_sessions WHERE id = ${id} RETURNING id
  `;
  if (!row) return notFound();
  return Response.json({ deleted: row.id });
});
