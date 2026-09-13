import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// Editing an item is how an unverified `starter` value — or an `official`
// one the source left blank — becomes John's own confirmed number. Changing
// any interval therefore re-sources the row to 'manual': the stored value is
// no longer what the manufacturer published, and it must stop claiming to be.
// Toggling `active` or editing the note alone is not a re-source.

const EDITABLE_INTERVALS = ['interval_miles', 'interval_months'];

export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  const body = await request.json();
  const updates = {};

  if ('name' in body) {
    const name = (body.name || '').trim();
    if (!name) {
      return Response.json({ error: 'name cannot be empty' }, { status: 400 });
    }
    updates.name = name;
  }

  for (const field of EDITABLE_INTERVALS) {
    if (field in body) {
      const value = body[field] === null ? null : Number(body[field]);
      if (value !== null && (!Number.isFinite(value) || value <= 0)) {
        return Response.json(
          { error: `${field} must be a positive number or null` },
          { status: 400 }
        );
      }
      updates[field] = value;
    }
  }

  if ('condition_note' in body) {
    updates.condition_note = body.condition_note?.trim() || null;
  }
  if ('active' in body) {
    updates.active = !!body.active;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json(
      { error: 'no valid fields to update' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [existing] = await sql`
    SELECT * FROM maintenance_items WHERE id = ${id}
  `;
  if (!existing) {
    return Response.json({ error: 'item not found' }, { status: 404 });
  }

  const intervalChanged = EDITABLE_INTERVALS.some(
    (field) => field in updates && updates[field] !== existing[field]
  );

  const nextMiles =
    'interval_miles' in updates
      ? updates.interval_miles
      : existing.interval_miles;
  const nextMonths =
    'interval_months' in updates
      ? updates.interval_months
      : existing.interval_months;

  // Clearing both intervals by hand would leave the row with nothing to
  // compute from and no source to blame for it.
  if (intervalChanged && nextMiles === null && nextMonths === null) {
    return Response.json(
      { error: 'set a mileage interval, a time interval, or both' },
      { status: 400 }
    );
  }

  const [row] = await sql`
    UPDATE maintenance_items SET
      name = COALESCE(${updates.name ?? null}, name),
      interval_miles = ${nextMiles},
      interval_months = ${nextMonths},
      condition_note = ${
        'condition_note' in updates
          ? updates.condition_note
          : existing.condition_note
      },
      active = COALESCE(${updates.active ?? null}, active),
      source = ${intervalChanged ? 'manual' : existing.source},
      source_url = ${intervalChanged ? null : existing.source_url},
      source_fetched_at = ${intervalChanged ? null : existing.source_fetched_at}
    WHERE id = ${id}
    RETURNING *
  `;
  return Response.json({ item: row });
});

export const DELETE = route(async (_request, { params }) => {
  const { id } = await params;
  const sql = getDb();
  const rows = await sql`
    DELETE FROM maintenance_items WHERE id = ${id} RETURNING id
  `;
  if (rows.length === 0) {
    return Response.json({ error: 'item not found' }, { status: 404 });
  }
  return Response.json({ ok: true });
});
