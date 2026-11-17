import { getDb } from '../../../../../lib/db';
import { route } from '../../../../../lib/route';
import {
  isUuid,
  loadTemplates,
  replaceTemplateItems,
  validateTemplateItems,
} from '../../../../../lib/workouts-data';

const notFound = () =>
  Response.json({ error: 'template not found' }, { status: 404 });

// Editing a template changes the plan only. Logged sets point at exercises
// and sessions, never at template rows, so history is untouched.
export const PATCH = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const body = await request.json();
  const sql = getDb();
  const [current] = await sql`SELECT * FROM workout_templates WHERE id = ${id}`;
  if (!current) return notFound();

  const next = { ...current };
  if ('name' in body) {
    next.name = (body.name || '').trim();
    if (!next.name) {
      return Response.json({ error: 'name cannot be blank' }, { status: 400 });
    }
  }
  if ('focus' in body) next.focus = (body.focus || '').trim() || null;
  if ('notes' in body) next.notes = (body.notes || '').trim() || null;

  let items = null;
  if ('exercises' in body) {
    const result = await validateTemplateItems(sql, body.exercises);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }
    items = result.items;
  }

  await sql`
    UPDATE workout_templates
    SET name = ${next.name}, focus = ${next.focus}, notes = ${next.notes},
        updated_at = now()
    WHERE id = ${id}
  `;
  if (items) await replaceTemplateItems(sql, id, items);
  const template = (await loadTemplates(sql)).find((t) => t.id === id);
  return Response.json({ template });
});

export const DELETE = route(async (request, { params }) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM workout_templates WHERE id = ${id} RETURNING id
  `;
  if (!row) return notFound();
  return Response.json({ deleted: row.id });
});
