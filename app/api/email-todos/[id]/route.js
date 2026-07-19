import { getDb } from '../../../../lib/db';
import { route, jsonError } from '../../../../lib/route';

// Per-to-do actions, keyed by the Gmail message id. PATCH marks done/undone
// (stamped, not deleted, so a to-do can be un-done — CLAUDE.md dismissible
// design). DELETE removes the flag entirely (un-star). Both user-input CRUD →
// route()-wrapped (§7).

// PATCH /api/email-todos/:id  { done: true | false }
export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.done !== 'boolean') {
    return jsonError('done (boolean) is required', 400);
  }

  const sql = getDb();
  const [row] = body.done
    ? await sql`
        UPDATE email_todos SET done_at = now()
        WHERE gmail_message_id = ${id}
        RETURNING gmail_message_id, subject, sender, snippet, flagged_at, done_at
      `
    : await sql`
        UPDATE email_todos SET done_at = NULL
        WHERE gmail_message_id = ${id}
        RETURNING gmail_message_id, subject, sender, snippet, flagged_at, done_at
      `;
  if (!row) return jsonError('To-do not found', 404);
  return Response.json({ todo: row });
});

// DELETE /api/email-todos/:id — remove the flag entirely.
export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM email_todos WHERE gmail_message_id = ${id}`;
  return Response.json({ ok: true });
});
