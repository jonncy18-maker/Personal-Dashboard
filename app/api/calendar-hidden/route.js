import { getDb } from '../../../lib/db';
import { route, jsonError } from '../../../lib/route';

// Per-event hides for the /calendar view. Google Calendar is read-only
// (CLAUDE.md §2/§7) — this only sets a local flag in our own DB, mirroring
// email_hidden; the real calendar event is never touched. Title/start are
// snapshotted at hide time so the "Hidden events" popup can list them without
// a second live Calendar call. User-input CRUD → route()-wrapped (§7).

// GET /api/calendar-hidden — all hidden events, newest-hidden first, for the
// management popup's undo list.
export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT gcal_event_id, title, start_label, hidden_at
    FROM calendar_hidden
    ORDER BY hidden_at DESC
  `;
  return Response.json({ hidden: rows });
});

// POST /api/calendar-hidden — hide an event (idempotent upsert on its id).
export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const id = body?.gcal_event_id;
  if (!id || typeof id !== 'string') {
    return jsonError('gcal_event_id is required', 400);
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO calendar_hidden (gcal_event_id, title, start_label)
    VALUES (${id}, ${body.title ?? null}, ${body.start ?? null})
    ON CONFLICT (gcal_event_id) DO UPDATE SET
      title = EXCLUDED.title,
      start_label = EXCLUDED.start_label
    RETURNING gcal_event_id, title, start_label, hidden_at
  `;
  return Response.json({ hidden: row }, { status: 201 });
});
