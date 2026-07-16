import { getDb } from '../../../lib/db';

// AI Projects CRUD. No auto-detection — "Add Project" is exactly two fields
// (github_url required, vercel_url optional). See CLAUDE.md §7. `status` +
// `featured` are the small manual layer (migration 007) the redesigned view
// leans on for its tabs/counts and featured panel; edited via [id]/route.js.

const STATUSES = [
  'planning',
  'active',
  'needs_attention',
  'on_hold',
  'blocked',
  'completed',
];

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, github_url, vercel_url, status, featured, created_at, updated_at
    FROM projects
    ORDER BY created_at DESC
  `;
  return Response.json({ projects: rows });
}

export async function POST(request) {
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

  const status = STATUSES.includes(body.status) ? body.status : 'active';

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO projects (github_url, vercel_url, status)
    VALUES (${githubUrl}, ${vercelUrl || null}, ${status})
    RETURNING id, github_url, vercel_url, status, featured, created_at, updated_at
  `;
  return Response.json({ project: row }, { status: 201 });
}
