import { getDb } from '../../../lib/db';

// Idea Board CRUD — the someday/maybe backlog. Distinct from Schedules by
// having NO due date (see CLAUDE.md §7): title, notes, status, domain_tag.
// No promotion path to AI Projects — deliberately kept separate.

const STATUSES = ['open', 'in_progress', 'done'];
const DOMAIN_TAGS = [
  'ai_projects',
  'travel',
  'schedules',
  'language',
  'general',
];

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, title, notes, status, domain_tag, created_at, updated_at
    FROM ideas
    ORDER BY (status = 'done'), created_at DESC
  `;
  return Response.json({ ideas: rows });
}

export async function POST(request) {
  const body = await request.json();
  const title = (body.title || '').trim();

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }

  const notes = body.notes || null;
  const status = STATUSES.includes(body.status) ? body.status : 'open';
  const domainTag = DOMAIN_TAGS.includes(body.domain_tag)
    ? body.domain_tag
    : 'general';

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO ideas (title, notes, status, domain_tag)
    VALUES (${title}, ${notes}, ${status}, ${domainTag})
    RETURNING id, title, notes, status, domain_tag, created_at, updated_at
  `;
  return Response.json({ idea: row }, { status: 201 });
}
