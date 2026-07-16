import { getDb } from '../../../lib/db';
import { briefSignature, generateBrief } from '../../../lib/travel-brief';

// GET the AI Travel Brief. Cached in travel_brief and regenerated only when the
// trips it summarizes (or the calendar day) change — never a model call on a
// plain page load. Returns { brief: string | null }; null when there's nothing
// to summarize, no API key, or Haiku failed (the UI simply hides the panel).

export async function GET() {
  const sql = getDb();

  const trips = await sql`
    SELECT id, destination, start_date, end_date, status, budget, itinerary
    FROM trips
  `;
  const signature = briefSignature(trips);

  const [cached] = await sql`
    SELECT id, brief, signature FROM travel_brief
    ORDER BY updated_at DESC LIMIT 1
  `;
  if (cached && cached.signature === signature) {
    return Response.json({ brief: cached.brief });
  }

  const brief = await generateBrief(trips);
  if (!brief) {
    return Response.json({ brief: null });
  }

  if (cached) {
    await sql`
      UPDATE travel_brief
      SET brief = ${brief}, signature = ${signature}
      WHERE id = ${cached.id}
    `;
  } else {
    await sql`
      INSERT INTO travel_brief (brief, signature) VALUES (${brief}, ${signature})
    `;
  }

  return Response.json({ brief });
}
