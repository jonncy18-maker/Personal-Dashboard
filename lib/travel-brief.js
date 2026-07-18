import { getAnthropic, MODEL } from './anthropic';

// Server-side only. Generates John's "AI Travel Brief" (CLAUDE.md §7) — a short,
// warm summary of what's coming up. The hard rule: it is grounded STRICTLY in
// the trip facts we actually have (countdowns, trip length, budget set-or-not,
// itinerary planned-or-not). It must never invent flight availability, prices,
// weather, seasons, or any fact not in the data — that would be a hallucinated
// travel claim presented as advice.
//
// It is cached (travel_brief table) keyed by `signature`, so a page load never
// triggers a model call unless the underlying trips (or the calendar day, for
// fresh countdowns) actually changed.

const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey(now) {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function startOfLocalDay(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

// Only upcoming, dated trips feed the brief — sorted soonest first.
function upcomingFacts(trips, now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return trips
    .filter((t) => t.status === 'upcoming' && t.start_date)
    // A trip's status never auto-flips when its dates pass (it's a manual
    // field — see neon/schema.sql), so a finished trip can still read
    // 'upcoming' here. Drop anything whose last day is already behind today.
    .filter((t) => {
      const ref = startOfLocalDay(t.end_date || t.start_date);
      return !ref || ref >= today;
    })
    .map((t) => {
      const start = startOfLocalDay(t.start_date);
      const end = t.end_date ? startOfLocalDay(t.end_date) : start;
      const daysUntil = start
        ? Math.max(0, Math.round((start - today) / DAY_MS))
        : null;
      const lengthDays =
        start && end ? Math.round((end - start) / DAY_MS) + 1 : null;
      const plannedDays = Array.isArray(t.itinerary) ? t.itinerary.length : 0;
      return {
        destination: t.destination,
        days_until: daysUntil,
        length_days: lengthDays,
        budget_set: t.budget != null,
        budget: t.budget != null ? Number(t.budget) : null,
        itinerary_planned_days: plannedDays,
      };
    })
    .sort((a, b) => (a.days_until ?? 1e9) - (b.days_until ?? 1e9));
}

// A stable fingerprint of everything the brief depends on, INCLUDING the
// calendar day (so countdowns stay honest — it regenerates at most once a day).
export function briefSignature(trips, now = new Date()) {
  return JSON.stringify({
    day: todayKey(now),
    facts: upcomingFacts(trips, now),
  });
}

export async function generateBrief(trips, now = new Date()) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const facts = upcomingFacts(trips, now);
  if (facts.length === 0) return null;

  const prompt = [
    'You write a short "travel brief" for John\'s personal dashboard.',
    '',
    'Use ONLY the facts in the JSON below. This is a hard rule:',
    '- Do NOT invent flight availability, prices, weather, seasons, crowds,',
    '  visa rules, or ANY fact not present in the JSON.',
    '- Only talk about: how soon a trip is, how long it is, whether a budget',
    '  is set, and whether an itinerary is planned (itinerary_planned_days).',
    '- If a useful nudge follows from the facts (e.g. a soon trip with no',
    '  itinerary, or a trip with no budget set), you may suggest it plainly.',
    '',
    'Style: 2–4 sentences, warm and concise, second person ("your ..."). No',
    'headings, no bullet list, no emoji. Refer to trips by destination.',
    '',
    'FACTS:',
    JSON.stringify(facts, null, 2),
  ].join('\n');

  try {
    const client = getAnthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      ?.filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    return text || null;
  } catch {
    return null;
  }
}
