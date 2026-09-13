import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { presetsForModel } from '../../../../lib/maintenance-presets';

// Seeding the schedule from the vehicle profile's model. Always an explicit
// click, never automatic on first load — and idempotent: an item whose name
// already exists is skipped rather than duplicated or overwritten, so a
// second click after John has edited his intervals cannot clobber them.
//
// The response says exactly what happened (added vs skipped) so the page can
// report it instead of implying a full reseed.

export const POST = route(async () => {
  const sql = getDb();
  const [settings] = await sql`
    SELECT vehicle_model FROM mileage_settings WHERE id = 1
  `;

  const model = settings?.vehicle_model || null;
  if (!model) {
    return Response.json(
      { error: 'set the vehicle model first' },
      { status: 400 }
    );
  }

  const presets = presetsForModel(model);
  if (presets.length === 0) {
    return Response.json(
      { error: `no built-in schedule for "${model}" — add items manually` },
      { status: 400 }
    );
  }

  const existing = await sql`SELECT name FROM maintenance_items`;
  const taken = new Set(existing.map((r) => r.name.trim().toLowerCase()));

  const added = [];
  const skipped = [];
  const fetchedAt = new Date().toISOString();

  for (const preset of presets) {
    if (taken.has(preset.name.trim().toLowerCase())) {
      skipped.push(preset.name);
      continue;
    }
    const [row] = await sql`
      INSERT INTO maintenance_items
        (name, interval_miles, interval_months, condition_note,
         active, source, source_url, source_fetched_at, sort_order)
      VALUES (
        ${preset.name},
        ${preset.interval_miles},
        ${preset.interval_months},
        ${preset.condition_note},
        ${preset.active},
        ${preset.source},
        ${preset.source_url ?? null},
        ${preset.source === 'official' ? fetchedAt : null},
        ${preset.sort_order}
      )
      RETURNING *
    `;
    added.push(row);
  }

  return Response.json({ added, skipped });
});
