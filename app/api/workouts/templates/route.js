import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import {
  loadTemplates,
  replaceTemplateItems,
  validateTemplateItems,
} from '../../../../lib/workouts-data';

export const GET = route(async () => {
  return Response.json({ templates: await loadTemplates(getDb()) });
});

export const POST = route(async (request) => {
  const body = await request.json();
  const name = (body.name || '').trim();
  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  const sql = getDb();
  const { items, error } = await validateTemplateItems(
    sql,
    body.exercises || []
  );
  if (error) return Response.json({ error }, { status: 400 });

  const [row] = await sql`
    INSERT INTO workout_templates (name, focus, notes, sort_order)
    VALUES (${name}, ${(body.focus || '').trim() || null},
            ${(body.notes || '').trim() || null},
            (SELECT coalesce(max(sort_order), 0) + 1 FROM workout_templates))
    RETURNING id
  `;
  await replaceTemplateItems(sql, row.id, items);
  const template = (await loadTemplates(sql)).find((t) => t.id === row.id);
  return Response.json({ template }, { status: 201 });
});
