import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { PROJECT_STATUSES } from '../../../../lib/projects';

// Edit a project's manual layer: status (lifecycle) and featured (the featured
// panel — at most one project, so setting it true clears the others). Also
// DELETE. The GitHub/Vercel-derived fields are never stored, so there's nothing
// else to patch here.

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const sql = getDb();

  const [existing] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (!existing) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }

  const status = PROJECT_STATUSES.includes(body.status)
    ? body.status
    : existing.status;
  const featured =
    typeof body.featured === 'boolean' ? body.featured : existing.featured;
  const category =
    body.category !== undefined
      ? String(body.category).trim() || null
      : existing.category;

  // Only one project is ever featured — clear the rest first when turning it on.
  if (featured && !existing.featured) {
    await sql`UPDATE projects SET featured = false WHERE featured = true`;
  }

  const [row] = await sql`
    UPDATE projects
    SET status = ${status}, featured = ${featured}, category = ${category}
    WHERE id = ${id}
    RETURNING id, github_url, vercel_url, status, featured, category,
              created_at, updated_at
  `;
  return Response.json({ project: row });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM projects WHERE id = ${id}`;
  return new Response(null, { status: 204 });
});
