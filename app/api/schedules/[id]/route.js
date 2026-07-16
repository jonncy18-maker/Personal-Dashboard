import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM schedules WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const title = (body.title ?? existing.title).trim();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  const dueDate =
    body.due_date !== undefined ? body.due_date : existing.due_date;
  if (!dueDate) {
    return Response.json({ error: 'due_date is required' }, { status: 400 });
  }
  const notes = body.notes !== undefined ? body.notes || null : existing.notes;
  const status = ['open', 'in_progress', 'done'].includes(body.status)
    ? body.status
    : existing.status;
  const linkedTripId =
    body.linked_trip_id !== undefined
      ? body.linked_trip_id || null
      : existing.linked_trip_id;
  const linkedProjectId = linkedTripId
    ? null
    : body.linked_project_id !== undefined
      ? body.linked_project_id || null
      : existing.linked_project_id;

  const [row] = await sql`
    UPDATE schedules SET
      title = ${title},
      notes = ${notes},
      due_date = ${dueDate},
      status = ${status},
      linked_trip_id = ${linkedTripId},
      linked_project_id = ${linkedProjectId}
    WHERE id = ${id}
    RETURNING id, title, notes, due_date, status, linked_trip_id,
              linked_project_id, created_at, updated_at
  `;
  return Response.json({
    schedule: { ...row, due_date: dateOnly(row.due_date) },
  });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM schedules WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
