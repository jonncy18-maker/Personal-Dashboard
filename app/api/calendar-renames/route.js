import { getDb } from '../../../lib/db';
import { route, jsonError } from '../../../lib/route';

// Local rename overrides for /calendar events. Google Calendar is read-only
// (CLAUDE.md §2/§7) — this only sets a display-title override in our own DB
// (calendar_renames), never a write back to the real event. User-input CRUD
// → route()-wrapped (§7).

// GET /api/calendar-renames — every active rename, for the management popup.
export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`
    SELECT scope_id, scope, title, updated_at
    FROM calendar_renames
    ORDER BY updated_at DESC
  `;
  return Response.json({ renames: rows });
});

// POST /api/calendar-renames — set (or replace) a rename, idempotent upsert
// on scope_id. `scope_id` is either the event's own id ("just this event") or
// its recurringEventId ("the whole series"); `scope` labels which for the
// management popup.
export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const { scope_id: scopeId, scope, title } = body || {};
  if (!scopeId || typeof scopeId !== 'string') {
    return jsonError('scope_id is required', 400);
  }
  if (scope !== 'event' && scope !== 'series') {
    return jsonError('scope must be "event" or "series"', 400);
  }
  if (!title || typeof title !== 'string' || !title.trim()) {
    return jsonError('title is required', 400);
  }

  const sql = getDb();
  const [row] = await sql`
    INSERT INTO calendar_renames (scope_id, scope, title)
    VALUES (${scopeId}, ${scope}, ${title.trim()})
    ON CONFLICT (scope_id) DO UPDATE SET
      scope = EXCLUDED.scope,
      title = EXCLUDED.title
    RETURNING scope_id, scope, title, updated_at
  `;
  return Response.json({ rename: row }, { status: 201 });
});
