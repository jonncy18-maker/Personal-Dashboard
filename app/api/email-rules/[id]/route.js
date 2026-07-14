import { getDb } from '../../../../lib/db';

// Undo a Tier 1 hide rule — deletes it outright, matching future emails from
// that sender are no longer filtered. See CLAUDE.md §5 (management view w/
// undo/delete).
export async function DELETE(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  await sql`DELETE FROM email_rules WHERE id = ${id}`;
  return new Response(null, { status: 204 });
}
