import { getAnthropic, MODEL } from './anthropic';

// Travel itinerary import — the app's third distinct AI use (CLAUDE.md §7).
// Unlike the Email tiers, this is genuine unstructured→structured extraction:
// confirmation/itinerary emails vary wildly by provider (cruise HTML port
// tables, airline text segments, hotel prose), so no deterministic parser
// generalizes. Haiku is scoped to exactly this step — the *finding* of the
// email is a plain Gmail search (see app/api/travel-import), and nothing is
// ever saved without John confirming the preview first (never auto-save).

export async function parseItineraryFromEmail({
  destination,
  subject,
  body,
  pdfs = [],
}) {
  if (!process.env.ANTHROPIC_API_KEY) return { days: [], configured: false };

  // Cruise/airline confirmations often carry the real itinerary only in a PDF
  // voucher. Haiku reads PDFs natively (base64 document blocks, no beta header),
  // so hand the attachment straight to the model rather than trying to scrape
  // it — far more reliable than parsing a PDF's raw bytes ourselves.
  const content = [];
  for (const data of pdfs) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data },
    });
  }
  content.push({
    type: 'text',
    text: `Trip destination: ${destination || '(unknown)'}\n\nEmail subject: ${subject || '(none)'}\n\nEmail body:\n${body || '(empty)'}${pdfs.length ? '\n\n(One or more itinerary PDFs are attached above — prefer them when they conflict with the email body.)' : ''}`,
  });

  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    system:
      'You extract a day-by-day travel itinerary from a booking or confirmation email ' +
      '(and any attached PDF voucher). Respond with ONLY a JSON array — no prose, no code ' +
      'fences. Each element is {"date": "YYYY-MM-DD" or "", "title": string, "notes": string}. ' +
      'One element per distinct day, port of call, flight segment, or hotel night, in ' +
      'chronological order. Use "" for date when no real calendar date is clearly present — ' +
      'never invent one. Keep title short (e.g. "Juneau — whale watching", "Flight LAX→SEA"); ' +
      'put times, confirmation numbers, and other detail in notes. If there is no itinerary ' +
      'content, respond with [].',
    messages: [{ role: 'user', content }],
  });

  const text = res.content?.[0]?.text?.trim() || '';
  return { days: safeParseDays(text), configured: true };
}

// Haiku is instructed to return bare JSON, but defensively tolerate prose or
// code fences around the array so a stray wrapper never drops the whole import.
function safeParseDays(text) {
  let raw = text;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((d) => ({
        date: typeof d?.date === 'string' ? d.date : '',
        title: typeof d?.title === 'string' ? d.title : '',
        notes: typeof d?.notes === 'string' ? d.notes : '',
      }))
      .filter((d) => d.title || d.notes || d.date);
  } catch {
    return [];
  }
}
