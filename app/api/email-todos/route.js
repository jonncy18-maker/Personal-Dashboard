import { getDb } from '../../../lib/db';
import { route, jsonError } from '../../../lib/route';

// To-do's flagged from the Email module. Our own DB table (email_todos) — the
// flag never touches Gmail (read-only boundary, CLAUDE.md §2/§7), same as
// email_hidden. Subject/sender/snippet are snapshotted here at flag time so
// the Home hero renders with no live Gmail call. User-input CRUD → route()
// wrapped (§7): an unexpected throw returns a JSON 500 the client can parse.

// GET /api/email-todos — open to-do's (done_at IS NULL) newest-flagged first.
export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT gmail_message_id, subject, sender, snippet, flagged_at
    FROM email_todos
    WHERE done_at IS NULL
    ORDER BY flagged_at DESC
  `;
  return Response.json({ todos: rows });
});

// POST /api/email-todos — flag a message as a to-do (idempotent upsert on the
// Gmail id; re-flagging a completed one clears done_at, bringing it back).
export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const id = body?.gmail_message_id;
  if (!id || typeof id !== 'string') {
    return jsonError('gmail_message_id is required', 400);
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO email_todos (gmail_message_id, subject, sender, snippet)
    VALUES (
      ${id},
      ${body.subject ?? null},
      ${body.sender ?? null},
      ${body.snippet ?? null}
    )
    ON CONFLICT (gmail_message_id) DO UPDATE SET
      subject = EXCLUDED.subject,
      sender  = EXCLUDED.sender,
      snippet = EXCLUDED.snippet,
      done_at = NULL
    RETURNING gmail_message_id, subject, sender, snippet, flagged_at
  `;
  return Response.json({ todo: row }, { status: 201 });
});
