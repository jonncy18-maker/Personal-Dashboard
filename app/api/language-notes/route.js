import { getDb } from '../../../lib/db';
import { route } from '../../../lib/route';

const LANGUAGES = ['spanish', 'french'];

// A tiny freeform note per language — currently only Spanish's editable
// "maintenance mode" line (CLAUDE.md §7: Spanish is ambient/daily immersion,
// not something with an hours metric to track).
export const GET = route(async () => {
  const sql = getDb();
  const rows = await sql`SELECT language, note FROM language_notes`;
  const notes = Object.fromEntries(rows.map((r) => [r.language, r.note]));
  return Response.json({ notes });
});

export const PATCH = route(async (request) => {
  const body = await request.json().catch(() => ({}));
  const { language, note } = body;
  if (!LANGUAGES.includes(language)) {
    return Response.json({ error: 'invalid language' }, { status: 400 });
  }
  const sql = getDb();
  const [row] = await sql`
    INSERT INTO language_notes (language, note)
    VALUES (${language}, ${note || ''})
    ON CONFLICT (language) DO UPDATE SET note = EXCLUDED.note
    RETURNING language, note
  `;
  return Response.json(row);
});
