import { getDb, num, dateOnly } from '../../../../lib/db';
import { getGmailClient } from '../../../../lib/google';
import { fetchDestinationPhoto } from '../../../../lib/unsplash';
import { parseItineraryForMessage } from '../../../../lib/itinerary-import';

function serialize(row) {
  return {
    ...row,
    budget: num(row.budget),
    start_date: dateOnly(row.start_date),
    end_date: dateOnly(row.end_date),
  };
}

// Approve a suggestion → create the real trip (with auto photo) and, per the
// scoped design (ROADMAP 2026-07-15), auto-run the itinerary import from the
// same source email so the trip lands populated. The suggestion is marked
// approved so it leaves the review queue. Never happens without this explicit
// click — the human gate.
export async function POST(request, { params }) {
  const { id } = await params;
  const sql = getDb();

  const [sugg] = await sql`
    SELECT id, destination, start_date, end_date, source_gmail_id, status
    FROM trip_suggestions WHERE id = ${id}
  `;
  if (!sugg) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  if (sugg.status !== 'pending') {
    return Response.json({ error: 'already handled' }, { status: 409 });
  }

  // Auto photo for the new trip (same path as manual trip create).
  const photo = await fetchDestinationPhoto(sugg.destination);

  // Auto-run the itinerary import from the source email; best-effort — a parse
  // failure still creates the trip, John can import manually later.
  let itinerary = null;
  const gmail = getGmailClient();
  if (gmail && sugg.source_gmail_id) {
    try {
      const { days } = await parseItineraryForMessage(
        gmail,
        sugg.source_gmail_id,
        sugg.destination
      );
      if (days && days.length) itinerary = JSON.stringify(days);
    } catch {
      // leave itinerary null; the trip is still created
    }
  }

  const [trip] = await sql`
    INSERT INTO trips (
      destination, start_date, end_date, status, itinerary,
      image_url, image_attribution, image_source
    )
    VALUES (
      ${sugg.destination}, ${sugg.start_date}, ${sugg.end_date}, 'upcoming',
      ${itinerary}, ${photo?.image_url || null},
      ${photo?.image_attribution || null}, 'auto'
    )
    RETURNING id, destination, start_date, end_date, status, notes, budget,
              itinerary, image_url, image_attribution, image_source,
              created_at, updated_at
  `;

  await sql`
    UPDATE trip_suggestions SET status = 'approved' WHERE id = ${id}
  `;

  return Response.json({ trip: serialize(trip) }, { status: 201 });
}

// Dismiss a suggestion → mark dismissed (remembered, so the scan never
// re-proposes it). Read-only Gmail is untouched.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const sql = getDb();
  await sql`
    UPDATE trip_suggestions SET status = 'dismissed'
    WHERE id = ${id} AND status = 'pending'
  `;
  return new Response(null, { status: 204 });
}
