import { getAnthropic, MODEL } from './anthropic';

// Weekly trip auto-detection (CLAUDE.md §7) — the AI half of app/api/trip-scan.
// The *finding* of candidate emails is a deterministic Gmail search (no model);
// this asks Haiku, per candidate, "is this a real upcoming/booked trip, and if
// so what's the destination and dates?" so the scan can propose it for John to
// confirm. Returns null when it's not a trip or the model is unconfident — the
// scan only ever proposes; nothing is auto-created.

export async function detectTripFromEmail({ subject, body }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const anthropic = getAnthropic();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      system:
        'You decide whether an email is a booking/confirmation for a specific real trip ' +
        '(a flight, hotel, cruise, or tour the reader has booked) and extract its basics. ' +
        'Respond with ONLY a JSON object — no prose, no code fences: ' +
        '{"is_trip": boolean, "destination": string, "start_date": "YYYY-MM-DD" or "", ' +
        '"end_date": "YYYY-MM-DD" or "", "confidence": 0-1}. ' +
        'destination is a place a human would name the trip by (e.g. "Panama Cruise", ' +
        '"Tokyo", "Alaska"). Use "" for a date not clearly present — never invent one. ' +
        'Set is_trip=false for marketing, price alerts, generic newsletters, or anything ' +
        'that is not a concrete booking. Be conservative: when unsure, low confidence.',
      messages: [
        {
          role: 'user',
          content: `Email subject: ${subject || '(none)'}\n\nEmail body:\n${body || '(empty)'}`,
        },
      ],
    });

    const text = res.content?.[0]?.text?.trim() || '';
    return parseDetection(text);
  } catch (err) {
    console.error('[trip-detect] Haiku detection failed:', err?.message || err);
    return null;
  }
}

function parseDetection(text) {
  let raw = text;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const d = JSON.parse(raw.slice(start, end + 1));
    if (!d?.is_trip) return null;
    const destination =
      typeof d.destination === 'string' ? d.destination.trim() : '';
    if (!destination) return null;
    const confidence = typeof d.confidence === 'number' ? d.confidence : 0;
    return {
      destination,
      start_date: isIsoDate(d.start_date) ? d.start_date : null,
      end_date: isIsoDate(d.end_date) ? d.end_date : null,
      confidence,
    };
  } catch {
    return null;
  }
}

function isIsoDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
