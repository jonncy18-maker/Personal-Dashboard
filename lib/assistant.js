import { getAnthropic } from './anthropic';

// The app-wide AI Assistant (sixth AI use — see CLAUDE.md §7). Unlike the five
// narrow Haiku uses, this is an agentic chat surface that can act across every
// domain, so it runs on Sonnet (John's call — Opus quality wasn't worth the
// cost here). Its tools call this app's OWN api routes over
// same-origin fetch — the assistant does exactly what the UI does, through the
// same validation, geocoding, photo caching, PTO math, and Gmail read-only
// boundary. No tool talks to a third-party API directly, and no Gmail write
// path exists anywhere for it to reach.
export const ASSISTANT_MODEL = 'claude-sonnet-5';

const MAX_ITERATIONS = 10;
const MAX_TOKENS = 4096;
const RESULT_CHAR_CAP = 15000;

const DATE = { type: 'string', description: 'YYYY-MM-DD' };
const ID = { type: 'integer', description: 'Row id' };

function obj(properties, required = []) {
  return { type: 'object', properties, required };
}

// Every tool maps to one allowlisted endpoint. `path` may be a string or a
// function of the validated input; `body` picks which input fields go in the
// JSON body (default: everything except `id`).
const CATALOG = [
  // ---- Overview ----
  {
    name: 'get_home_summary',
    description:
      'Per-domain summary counts shown on the Home cards (trips, tasks, ideas, projects, PTO left, next tutor call).',
    method: 'GET',
    path: '/api/home-summary',
    input_schema: obj({}),
  },

  // ---- Travel ----
  {
    name: 'list_trips',
    description:
      'All trips (upcoming/past/wishlist) with dates, status, notes, budget, itinerary and photo/map fields.',
    method: 'GET',
    path: '/api/trips',
    input_schema: obj({}),
  },
  {
    name: 'get_trip',
    description: 'One trip by id, including its full itinerary.',
    method: 'GET',
    path: (i) => `/api/trips/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },
  {
    name: 'create_trip',
    description:
      'Create a trip. The route auto-fetches a destination photo and geocodes the map pin, same as the UI.',
    method: 'POST',
    path: '/api/trips',
    input_schema: obj(
      {
        destination: { type: 'string' },
        start_date: DATE,
        end_date: DATE,
        status: { type: 'string', enum: ['upcoming', 'past', 'wishlist'] },
        notes: { type: 'string' },
        budget: { type: 'number' },
      },
      ['destination']
    ),
  },
  {
    name: 'update_trip',
    description:
      'Update trip fields. Only pass fields to change. pto_days_override / pto_exempt stick once set (auto PTO math never overwrites them).',
    method: 'PATCH',
    path: (i) => `/api/trips/${i.id}`,
    input_schema: obj(
      {
        id: ID,
        destination: { type: 'string' },
        start_date: DATE,
        end_date: DATE,
        status: { type: 'string', enum: ['upcoming', 'past', 'wishlist'] },
        notes: { type: 'string' },
        budget: { type: 'number' },
        pto_days_override: { type: 'number' },
        pto_exempt: { type: 'boolean' },
      },
      ['id']
    ),
  },
  {
    name: 'delete_trip',
    description:
      'Permanently delete a trip. Destructive — only after John explicitly confirmed in this conversation.',
    method: 'DELETE',
    path: (i) => `/api/trips/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },
  {
    name: 'get_travel_stats',
    description:
      'The honest Travel stat tiles: trips, nights, countries, cruise nights — all from real trip rows.',
    method: 'GET',
    path: '/api/travel-stats',
    input_schema: obj({}),
  },

  // ---- PTO Planner ----
  {
    name: 'get_pto',
    description:
      'Full PTO Planner state for a year (current year + 2 ahead): budget, taken/planned/left, per-trip breakdown, holidays, banked ledger, manual entries, wishlist simulations, saved scenarios.',
    method: 'GET',
    path: (i) => `/api/pto${i.year ? `?year=${i.year}` : ''}`,
    input_schema: obj({ year: { type: 'integer' } }),
  },
  {
    name: 'update_pto_budget',
    description:
      "Set the self-chosen annual PTO budget (John's own target — CrossCountry PTO is unlimited, there is no accrual).",
    method: 'PATCH',
    path: '/api/pto',
    input_schema: obj({ annual_budget: { type: 'integer' } }, [
      'annual_budget',
    ]),
  },
  {
    name: 'add_pto_holiday',
    description:
      'Add a firm-holiday row. worked=true means John worked it, earning a banked day.',
    method: 'POST',
    path: '/api/pto/holidays',
    input_schema: obj(
      {
        holiday_date: DATE,
        name: { type: 'string' },
        worked: { type: 'boolean' },
      },
      ['holiday_date', 'name']
    ),
  },
  {
    name: 'update_pto_holiday',
    description: 'Update a holiday row (name, date, worked toggle).',
    method: 'PATCH',
    path: (i) => `/api/pto/holidays/${i.id}`,
    input_schema: obj(
      {
        id: ID,
        holiday_date: DATE,
        name: { type: 'string' },
        worked: { type: 'boolean' },
      },
      ['id']
    ),
  },
  {
    name: 'delete_pto_holiday',
    description: 'Delete a holiday row. Destructive — confirm with John first.',
    method: 'DELETE',
    path: (i) => `/api/pto/holidays/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },
  {
    name: 'add_pto_entry',
    description:
      "Add a manual PTO entry: kind 'pto' (a non-trip PTO day) or 'banked_spend' (spend a banked holiday; refused if none available).",
    method: 'POST',
    path: '/api/pto/entries',
    input_schema: obj(
      {
        entry_date: DATE,
        kind: { type: 'string', enum: ['pto', 'banked_spend'] },
        note: { type: 'string' },
      },
      ['entry_date', 'kind']
    ),
  },
  {
    name: 'delete_pto_entry',
    description:
      'Delete a manual PTO entry. Destructive — confirm with John first.',
    method: 'DELETE',
    path: (i) => `/api/pto/entries/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },

  // ---- Ideas ----
  {
    name: 'list_ideas',
    description: 'All Idea Board ideas (no due dates — someday/maybe).',
    method: 'GET',
    path: '/api/ideas',
    input_schema: obj({}),
  },
  {
    name: 'create_idea',
    description:
      'Create an idea. Ideas never carry a due date — anything with a due date belongs in Schedules instead.',
    method: 'POST',
    path: '/api/ideas',
    input_schema: obj(
      {
        title: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'done'] },
        domain_tag: {
          type: 'string',
          enum: ['ai_projects', 'travel', 'schedules', 'language', 'general'],
        },
      },
      ['title']
    ),
  },
  {
    name: 'update_idea',
    description: 'Update an idea (title, notes, status, domain_tag).',
    method: 'PATCH',
    path: (i) => `/api/ideas/${i.id}`,
    input_schema: obj(
      {
        id: ID,
        title: { type: 'string' },
        notes: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'done'] },
        domain_tag: {
          type: 'string',
          enum: ['ai_projects', 'travel', 'schedules', 'language', 'general'],
        },
      },
      ['id']
    ),
  },
  {
    name: 'delete_idea',
    description:
      'Permanently delete an idea. Destructive — confirm with John first.',
    method: 'DELETE',
    path: (i) => `/api/ideas/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },

  // ---- Schedules ----
  {
    name: 'list_schedule_tasks',
    description:
      'All Schedules tasks (cross-domain, each with a due date; may link a trip or an AI project).',
    method: 'GET',
    path: '/api/schedules',
    input_schema: obj({}),
  },
  {
    name: 'create_schedule_task',
    description:
      'Create a Schedules task. Must have a due date — that is the boundary with the Idea Board.',
    method: 'POST',
    path: '/api/schedules',
    input_schema: obj(
      {
        title: { type: 'string' },
        due_date: DATE,
        notes: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'done'] },
        linked_trip_id: ID,
        linked_project_id: ID,
      },
      ['title', 'due_date']
    ),
  },
  {
    name: 'update_schedule_task',
    description: 'Update a Schedules task.',
    method: 'PATCH',
    path: (i) => `/api/schedules/${i.id}`,
    input_schema: obj(
      {
        id: ID,
        title: { type: 'string' },
        due_date: DATE,
        notes: { type: 'string' },
        status: { type: 'string', enum: ['open', 'in_progress', 'done'] },
        linked_trip_id: ID,
        linked_project_id: ID,
      },
      ['id']
    ),
  },
  {
    name: 'delete_schedule_task',
    description:
      'Permanently delete a Schedules task. Destructive — confirm with John first.',
    method: 'DELETE',
    path: (i) => `/api/schedules/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },

  // ---- AI Projects ----
  {
    name: 'list_projects',
    description:
      'AI Projects overview: real GitHub/Vercel data (description, topics, last commit, issues, deploy status, milestone progress, activity) plus the manual layer (status, featured, category).',
    method: 'GET',
    path: '/api/projects/overview',
    input_schema: obj({}),
  },
  {
    name: 'add_project',
    description:
      'Track a new project. Two explicit fields only — no auto-detection, by design.',
    method: 'POST',
    path: '/api/projects',
    input_schema: obj(
      {
        github_url: { type: 'string' },
        vercel_url: { type: 'string' },
      },
      ['github_url']
    ),
  },
  {
    name: 'update_project',
    description:
      "Update a project's manual layer: status, featured (at most one project), category (free text).",
    method: 'PATCH',
    path: (i) => `/api/projects/${i.id}`,
    input_schema: obj(
      {
        id: ID,
        status: {
          type: 'string',
          enum: [
            'planning',
            'active',
            'needs_attention',
            'on_hold',
            'blocked',
            'completed',
          ],
        },
        featured: { type: 'boolean' },
        category: { type: 'string' },
      },
      ['id']
    ),
  },
  {
    name: 'delete_project',
    description:
      'Stop tracking a project. Destructive — confirm with John first.',
    method: 'DELETE',
    path: (i) => `/api/projects/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },

  // ---- Email (Gmail is READ-ONLY — hard boundary) ----
  {
    name: 'list_inbox',
    description:
      'Recent inbox emails via the read-only Gmail proxy, already filtered by Tier 1/Tier 2 hide rules. Never modifies the mailbox.',
    method: 'GET',
    path: '/api/gmail',
    input_schema: obj({}),
  },
  {
    name: 'list_email_rules',
    description: 'Active Tier 1 (sender) and Tier 2 (content) hide rules.',
    method: 'GET',
    path: '/api/email-rules',
    input_schema: obj({}),
  },
  {
    name: 'create_email_rule',
    description:
      'Create a hide rule. Tier 1: sender domain only (deterministic, no AI). Tier 2: sender + a plain-language rule_text evaluated by Haiku. Hiding is a local flag — Gmail itself is never touched.',
    method: 'POST',
    path: '/api/email-rules',
    input_schema: obj(
      {
        tier: { type: 'integer', enum: [1, 2] },
        sender: {
          type: 'string',
          description: 'Sender domain (tier 1) or address/domain (tier 2)',
        },
        rule_text: {
          type: 'string',
          description: 'Tier 2 only — plain-language rule',
        },
      },
      ['tier', 'sender']
    ),
  },
  {
    name: 'delete_email_rule',
    description: 'Deactivate a hide rule (its emails reappear).',
    method: 'DELETE',
    path: (i) => `/api/email-rules/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },
  {
    name: 'list_email_todos',
    description: "Emails John flagged as to-do's (shown on the Home hero).",
    method: 'GET',
    path: '/api/email-todos',
    input_schema: obj({}),
  },
  {
    name: 'add_email_todo',
    description:
      'Flag an email as a to-do (local row only — no Gmail star is written). Get gmail_message_id/subject/sender/snippet from list_inbox.',
    method: 'POST',
    path: '/api/email-todos',
    input_schema: obj(
      {
        gmail_message_id: { type: 'string' },
        subject: { type: 'string' },
        sender: { type: 'string' },
        snippet: { type: 'string' },
      },
      ['gmail_message_id']
    ),
  },
  {
    name: 'update_email_todo',
    description: 'Mark an email to-do done (or not).',
    method: 'PATCH',
    path: (i) => `/api/email-todos/${i.id}`,
    input_schema: obj({ id: ID, done: { type: 'boolean' } }, ['id', 'done']),
  },
  {
    name: 'delete_email_todo',
    description: 'Remove an email to-do row.',
    method: 'DELETE',
    path: (i) => `/api/email-todos/${i.id}`,
    input_schema: obj({ id: ID }, ['id']),
  },

  // ---- Calendar / Language ----
  {
    name: 'get_calendar_events',
    description:
      'Read-only Google Calendar events in a window. from/to are ISO dates (inclusive/exclusive).',
    method: 'GET',
    path: (i) => `/api/calendar-events?from=${i.from}&to=${i.to}`,
    input_schema: obj({ from: DATE, to: DATE }, ['from', 'to']),
  },
  {
    name: 'get_next_tutor_call',
    description: 'The next Spanish tutor call from Google Calendar.',
    method: 'GET',
    path: '/api/calendar',
    input_schema: obj({}),
  },
  {
    name: 'get_language',
    description:
      'Language notes (Spanish maintenance line) — pair with get_french_progress for French hours.',
    method: 'GET',
    path: '/api/language-notes',
    input_schema: obj({}),
  },
  {
    name: 'get_french_progress',
    description:
      'French listening-hours log and headline total (from Dreaming French screenshot imports).',
    method: 'GET',
    path: '/api/french-progress',
    input_schema: obj({}),
  },
  {
    name: 'update_language_note',
    description: "Update a language's freeform note.",
    method: 'PATCH',
    path: '/api/language-notes',
    input_schema: obj(
      {
        language: { type: 'string', enum: ['spanish', 'french'] },
        note: { type: 'string' },
      },
      ['language', 'note']
    ),
  },
];

const TOOLS = CATALOG.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema,
}));
const TOOL_MAP = new Map(CATALOG.map((t) => [t.name, t]));

function systemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `You are the built-in assistant for John's Personal Dashboard — a private, single-user planning hub with six domains: AI Projects, Travel (which also hosts the PTO Planner), Schedules, Language Learning, Idea Board, and Email, plus a read-only Calendar view.

You act for John through the same API endpoints the dashboard UI uses, so anything you do behaves exactly as if he clicked it himself. Ground every answer in tool results — never invent counts, dates, deploy statuses, or email contents.

House rules (these mirror the app's own hard boundaries):
- Gmail is read-only, full stop. "Hiding" an email or flagging a to-do only writes a local row in this app's database; the real mailbox is never touched, and no tool exists that could touch it.
- Idea Board vs Schedules: the boundary is the due date. No due date → idea; has a due date → Schedules task.
- Destructive actions (any delete) require John's explicit confirmation in this conversation first. If he hasn't clearly asked to delete that specific thing, ask before calling the tool.
- Don't fabricate metrics or data the app doesn't have — this app deliberately shows "—" over invented numbers.
- Dates are YYYY-MM-DD. Today is ${today}.

Style: be concise and direct. Lead with what you did or found. When you change data, summarize the change in one sentence; the UI refreshes automatically.`;
}

async function executeTool(origin, name, input) {
  const tool = TOOL_MAP.get(name);
  if (!tool) return { ok: false, result: `Unknown tool: ${name}` };

  const path = typeof tool.path === 'function' ? tool.path(input) : tool.path;
  const init = { method: tool.method };
  if (tool.method !== 'GET' && tool.method !== 'DELETE') {
    const body = { ...input };
    if (typeof tool.path === 'function') delete body.id;
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(origin + path, init);
    let text = await res.text();
    if (text.length > RESULT_CHAR_CAP) {
      text = text.slice(0, RESULT_CHAR_CAP) + '\n…[truncated]';
    }
    return { ok: res.ok, status: res.status, path, result: text };
  } catch (err) {
    return { ok: false, path, result: `Request failed: ${err.message}` };
  }
}

// Runs the agentic loop for one user turn. `messages` is the full prior
// conversation in raw Anthropic block form (the client stores and resends it
// verbatim, which also keeps thinking blocks intact across turns).
// Returns the new turns to append, the final reply text, and an action log.
export async function runAssistant({ messages, origin }) {
  const client = getAnthropic();
  const turns = [];
  const actions = [];
  const history = [...messages];

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: systemPrompt(),
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: TOOLS,
      messages: history,
    });

    const assistantTurn = { role: 'assistant', content: response.content };
    turns.push(assistantTurn);
    history.push(assistantTurn);

    if (response.stop_reason === 'refusal') {
      return {
        turns,
        actions,
        reply: 'I had to decline that request.',
      };
    }

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0 || response.stop_reason !== 'tool_use') {
      const reply = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { turns, actions, reply };
    }

    const results = [];
    for (const use of toolUses) {
      const outcome = await executeTool(origin, use.name, use.input || {});
      const tool = TOOL_MAP.get(use.name);
      actions.push({
        tool: use.name,
        ok: outcome.ok,
        write: tool ? tool.method !== 'GET' : false,
      });
      results.push({
        type: 'tool_result',
        tool_use_id: use.id,
        content: outcome.result,
        is_error: !outcome.ok,
      });
    }
    const resultTurn = { role: 'user', content: results };
    turns.push(resultTurn);
    history.push(resultTurn);
  }

  return {
    turns,
    actions,
    reply:
      'I hit my per-message action limit before finishing — tell me to continue and I will pick up where I left off.',
  };
}
