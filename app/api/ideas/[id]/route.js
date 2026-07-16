import { getDb } from '../../../../lib/db';

const STATUSES = ['open', 'in_progress', 'done'];
const DOMAIN_TAGS = [
  'ai_projects',
  'travel',
  'schedules',
  'language',
  'general',
];

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM ideas WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const title = (body.title ?? existing.title).trim();
  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  const notes = body.notes !== undefined ? body.notes || null : existing.notes;
  const status = STATUSES.includes(body.status) ? body.status : existing.status;
  const domainTag = DOMAIN_TAGS.includes(body.domain_tag)
    ? body.domain_tag
    : existing.domain_tag;

  const [row] = await sql`
    UPDATE ideas SET
      title = ${title},
      notes = ${notes},
      status = ${status},
      domain_tag = ${domainTag}
    WHERE id = ${id}
    RETURNING id, title, notes, status, domain_tag, created_at, updated_at
  `;
  return Response.json({ idea: row });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM ideas WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
