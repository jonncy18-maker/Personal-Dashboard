import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';
import {
  normalizeChecklistItems,
  instantiateItems,
} from '../../../lib/checklists';

// A checklist applied to a trip (migration 010). GET ?tripId= lists a trip's
// checklists; POST applies a template to a trip by COPYING its items (so a
// later template edit never disturbs this trip's checked state) — or creates a
// blank named checklist when no template is given.

export const GET = route(async (request) => {
  const tripId = new URL(request.url).searchParams.get('tripId');
  if (!tripId) {
    return Response.json({ error: 'tripId is required' }, { status: 400 });
  }
  const sql = getDb();
  const rows = await sql`
    SELECT id, trip_id, template_id, title, items, created_at, updated_at
    FROM trip_checklists
    WHERE trip_id = ${tripId}
    ORDER BY created_at ASC
  `;
  return Response.json({ checklists: rows });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const tripId = body.trip_id;
  if (!tripId) {
    return Response.json({ error: 'trip_id is required' }, { status: 400 });
  }

  const sql = getDb();
  const [trip] = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
  if (!trip) {
    return Response.json({ error: 'trip not found' }, { status: 404 });
  }

  let title = (body.title || '').trim();
  let items;
  let templateId = null;

  if (body.template_id) {
    const [template] =
      await sql`SELECT * FROM checklist_templates WHERE id = ${body.template_id}`;
    if (!template) {
      return Response.json({ error: 'template not found' }, { status: 404 });
    }
    templateId = template.id;
    if (!title) title = template.name;
    items = instantiateItems(template.items);
  } else {
    // Blank checklist — must at least have a title.
    if (!title) {
      return Response.json(
        { error: 'title or template_id is required' },
        { status: 400 }
      );
    }
    items = normalizeChecklistItems(body.items);
  }

  const [row] = await sql`
    INSERT INTO trip_checklists (trip_id, template_id, title, items)
    VALUES (${tripId}, ${templateId}, ${title}, ${JSON.stringify(items)})
    RETURNING id, trip_id, template_id, title, items, created_at, updated_at
  `;
  return Response.json({ checklist: row }, { status: 201 });
});
