import { getAnthropic, MODEL } from './anthropic';

// Schedules screenshot import — a new, narrowly-scoped AI use (CLAUDE.md §7).
// John can screenshot anything with an actionable item in it (a text message,
// a to-do list app, a sticky note, an email snippet, a calendar reminder) and
// have Haiku read out candidate tasks instead of retyping them by hand. Same
// never-auto-save discipline as French's hours-log import and Travel's
// itinerary import: this only returns a preview — app/api/schedules (the
// existing CRUD route, unchanged) is the only thing that ever writes a row,
// and only for tasks John confirms/edits first.
//
// Unlike French's import (one known source, one fixed shape), a schedule
// screenshot's source is arbitrary, so the model may find zero, one, or
// several tasks in a single image (e.g. a photo of a whole to-do list).

export async function parseScheduleScreenshot(imageBase64, mediaType) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { tasks: [], configured: false };
  }

  // Resolving "tomorrow" / "next Friday" / "the 15th" needs real today —
  // server clock, never the client's, so a wrong device clock can't skew it.
  const today = new Date().toISOString().slice(0, 10);

  const anthropic = getAnthropic();
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system:
      `Today's date is ${today}. You read a screenshot that may contain one or ` +
      'more actionable tasks — a text message, a to-do list app, a note, an ' +
      'email snippet, a calendar reminder, a checklist, anything. Respond with ' +
      'ONLY JSON — no prose, no code fences — shaped {"tasks": ' +
      '[{"title": string, "due_date": "YYYY-MM-DD"|"", "notes": string|""}]}. ' +
      'Each task needs a short, clear title (rewrite loosely worded text into a ' +
      'plain task, e.g. "can u grab milk tmrw" -> title "Grab milk"). Resolve ' +
      'relative dates ("tomorrow", "next Friday", "the 15th") against today\'s ' +
      'date above into a real YYYY-MM-DD; if no date is stated or implied, leave ' +
      'due_date as "" — never invent or guess a date. "notes" is only extra ' +
      'context actually present in the image (e.g. an address, an amount, who ' +
      'asked) — omit it ("") rather than paraphrase filler. If the screenshot has ' +
      'no actionable task at all, return {"tasks": []}. Never invent a task that ' +
      "isn't there.",
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract any actionable task(s) from this screenshot.',
          },
        ],
      },
    ],
  });

  const text = res.content?.[0]?.text?.trim() || '';
  return { tasks: safeParseTasks(text), configured: true };
}

// Haiku is instructed to return bare JSON, but defensively tolerate prose or
// code fences around the object so a stray wrapper never drops the import.
function safeParseTasks(text) {
  let raw = text;
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  if (fence) raw = fence[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return [];

  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed.tasks)) return [];
    return parsed.tasks
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        due_date: typeof t.due_date === 'string' ? t.due_date : '',
        notes: typeof t.notes === 'string' ? t.notes.trim() : '',
      }));
  } catch {
    return [];
  }
}
