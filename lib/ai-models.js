import { getAnthropic, MODEL as HAIKU_MODEL } from './anthropic';

// Task → model registry for the text-only Haiku-class jobs. Server-only.
//
// Every task listed in LUNA_TASKS runs on Luna whenever OPENAI_API_KEY is set,
// and on Haiku otherwise. So the key's Vercel scope is the switch: add it to
// Preview only to try Luna while Production stays on Haiku. Which tasks are
// eligible is decided here, in code. One optional env var:
//
//   AI_FORCE_ANTHROPIC=1   → everything back to Haiku, whatever else is set
//
// The screenshot and PDF jobs (french-progress, schedule-import, travel-import)
// also go through completeText, but are deliberately NOT in LUNA_TASKS: Luna's
// image/PDF input is unconfirmed, so in production they stay on Haiku. They only
// reach Luna through the temporary side-by-side tool (app/api/luna-compare),
// which passes `provider: 'luna'` explicitly. A task joins LUNA_TASKS once John
// has compared real files. The model IDs are API arguments and stay pinned to
// exact IDs, same as lib/anthropic.js.
export const LUNA_MODEL = 'gpt-6-luna';

export const LUNA_TASKS = ['email-tier2', 'trip-detect'];

const OPENAI_URL = 'https://api.openai.com/v1/responses';

// Reasoning tokens count against max_output_tokens on current OpenAI models, so
// a tight cap (the 8-token HIDE/KEEP answer) can be spent entirely on thinking
// and return nothing. Headroom is added on top of the caller's cap.
const REASONING_HEADROOM = 600;
const TIMEOUT_MS = 20000;
// Reading an image or PDF takes longer than a short text answer.
const TIMEOUT_MS_MEDIA = 40000;

export function providerFor(task, env = process.env) {
  if (!LUNA_TASKS.includes(task)) return 'anthropic';
  if (env.AI_FORCE_ANTHROPIC === '1') return 'anthropic';
  if (!env.OPENAI_API_KEY) return 'anthropic';
  return 'luna';
}

// True when at least one provider for this task has a key. Callers use it where
// they used to check ANTHROPIC_API_KEY, so a Luna-only deploy still runs.
export function canRun(task, env = process.env) {
  return providerFor(task, env) === 'luna' || Boolean(env.ANTHROPIC_API_KEY);
}

// `user` is a plain string or an array of parts, in the caller's order:
//   { type: 'text', text } | { type: 'image', mediaType, data } |
//   { type: 'document', mediaType, data }   (data is base64, no data: prefix)
function hasMedia(user) {
  return Array.isArray(user) && user.some((p) => p.type !== 'text');
}

function toLunaInput(user) {
  if (!Array.isArray(user)) return user;
  return [
    {
      role: 'user',
      content: user.map((p) => {
        if (p.type === 'text') return { type: 'input_text', text: p.text };
        const url = `data:${p.mediaType};base64,${p.data}`;
        if (p.type === 'image') return { type: 'input_image', image_url: url };
        return {
          type: 'input_file',
          filename: 'document.pdf',
          file_data: url,
        };
      }),
    },
  ];
}

function toAnthropicContent(user) {
  if (!Array.isArray(user)) return user;
  return user.map((p) => {
    if (p.type === 'text') return { type: 'text', text: p.text };
    return {
      type: p.type === 'image' ? 'image' : 'document',
      source: { type: 'base64', media_type: p.mediaType, data: p.data },
    };
  });
}

async function callLuna({ system, user, maxTokens }) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(hasMedia(user) ? TIMEOUT_MS_MEDIA : TIMEOUT_MS),
    body: JSON.stringify({
      model: LUNA_MODEL,
      instructions: system,
      input: toLunaInput(user),
      max_output_tokens: maxTokens + REASONING_HEADROOM,
      reasoning: { effort: 'low' },
      store: false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `OpenAI ${res.status}: ${err?.error?.message || res.statusText}`
    );
  }
  const data = await res.json();
  if (data.status === 'incomplete') {
    throw new Error(
      `OpenAI response incomplete (${data.incomplete_details?.reason || 'unknown'})`
    );
  }
  const text = (data.output || [])
    .filter((item) => item.type === 'message')
    .flatMap((item) => item.content || [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text)
    .join('')
    .trim();
  if (!text) throw new Error('OpenAI returned no text');
  return text;
}

async function callHaiku({ system, user, maxTokens }) {
  const res = await getAnthropic().messages.create({
    model: HAIKU_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: toAnthropicContent(user) }],
  });
  return res.content?.[0]?.text?.trim() || '';
}

// One system string + one user input (string or parts) in, one text answer out.
// A Luna failure (HTTP error, truncation, empty reply) falls back to Haiku for
// that call when an Anthropic key exists, so flipping a task can't make the
// feature fail where it didn't before. Throws only when no provider could
// answer.
//
// `provider` forces a side: 'anthropic' always uses Haiku; 'luna' always uses
// Luna and never falls back, so a comparison can't be papered over by Haiku.
// Production callers never pass it.
export async function completeText({
  task,
  system,
  user,
  maxTokens,
  provider,
}) {
  if (provider === 'luna') return callLuna({ system, user, maxTokens });
  if (provider !== 'anthropic' && providerFor(task) === 'luna') {
    try {
      return await callLuna({ system, user, maxTokens });
    } catch (err) {
      console.error(
        `[ai:${task}] Luna failed${process.env.ANTHROPIC_API_KEY ? ', falling back to Haiku' : ''}:`,
        err?.message || err
      );
      if (!process.env.ANTHROPIC_API_KEY) throw err;
    }
  }
  return callHaiku({ system, user, maxTokens });
}
