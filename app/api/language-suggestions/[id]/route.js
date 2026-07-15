import { getDb } from '../../../../lib/db';

// Approve a suggestion → the row itself becomes the record (unlike Travel,
// there's no separate table to create into; findNextTutorCall reads approved
// language_calls directly). Dismiss → remembered, so the scan never
// re-proposes it. Read-only Gmail is untouched either way — the human click
// is the only thing that changes state.
export async function POST(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  const [row] = await sql`
    UPDATE language_calls SET status = 'approved'
    WHERE id = ${id} AND status = 'pending'
    RETURNING id, tutor, start_at, source_subject
  `;
  if (!row) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  return Response.json({ call: row });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  await sql`
    UPDATE language_calls SET status = 'dismissed'
    WHERE id = ${id} AND status = 'pending'
  `;
  return new Response(null, { status: 204 });
}
