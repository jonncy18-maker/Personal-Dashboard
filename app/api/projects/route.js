import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';
import { PROJECT_STATUSES } from '../../../lib/projects';

// AI Projects CRUD. No auto-detection — "Add Project" is exactly two fields
// (github_url required, vercel_url optional). See CLAUDE.md §7. `status` +
// `featured` are the small manual layer (migration 007) the redesigned view
// leans on for its tabs/counts and featured panel; edited via [id]/route.js.

export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT id, github_url, vercel_url, status, featured, category,
           created_at, updated_at
    FROM projects
    ORDER BY created_at DESC
  `;
  return Response.json({ projects: rows });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const githubUrl = (body.github_url || '').trim();
  const vercelUrl = (body.vercel_url || '').trim();

  if (!githubUrl) {
    return Response.json({ error: 'github_url is required' }, { status: 400 });
  }
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(githubUrl)) {
    return Response.json(
      { error: 'github_url must look like https://github.com/owner/repo' },
      { status: 400 }
    );
  }

  const status = PROJECT_STATUSES.includes(body.status)
    ? body.status
    : 'active';
  const category = body.category ? String(body.category).trim() || null : null;

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO projects (github_url, vercel_url, status, category)
    VALUES (${githubUrl}, ${vercelUrl || null}, ${status}, ${category})
    RETURNING id, github_url, vercel_url, status, featured, category,
              created_at, updated_at
  `;
  return Response.json({ project: row }, { status: 201 });
});
