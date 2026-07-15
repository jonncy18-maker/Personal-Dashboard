import { getDb } from '../../../lib/db';

// Schedules CRUD — the cross-domain task list. Distinct from Idea Board by
// having a required due_date (see CLAUDE.md §7). Optional link to a Travel
// trip or AI project; the two link columns are mutually exclusive but not
// DB-enforced since only this route ever writes them.

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT s.id, s.title, s.notes, s.due_date, s.status,
           s.linked_trip_id, s.linked_project_id,
           t.destination AS linked_trip_destination,
           p.github_url AS linked_project_github_url,
           s.created_at, s.updated_at
    FROM schedules s
    LEFT JOIN trips t ON t.id = s.linked_trip_id
    LEFT JOIN projects p ON p.id = s.linked_project_id
    ORDER BY (s.status = 'done'), s.due_date ASC, s.created_at DESC
  `;
  return Response.json({ schedules: rows });
}

export async function POST(request) {
  const body = await request.json();
  const title = (body.title || '').trim();
  const dueDate = body.due_date || null;

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  if (!dueDate) {
    return Response.json({ error: 'due_date is required' }, { status: 400 });
  }

  const notes = body.notes || null;
  const status = ['open', 'in_progress', 'done'].includes(body.status)
    ? body.status
    : 'open';
  const linkedTripId = body.linked_trip_id || null;
  const linkedProjectId = linkedTripId ? null : body.linked_project_id || null;

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO schedules (
      title, notes, due_date, status, linked_trip_id, linked_project_id
    )
    VALUES (
      ${title}, ${notes}, ${dueDate}, ${status}, ${linkedTripId}, ${linkedProjectId}
    )
    RETURNING id, title, notes, due_date, status, linked_trip_id,
              linked_project_id, created_at, updated_at
  `;
  return Response.json({ schedule: row }, { status: 201 });
}
