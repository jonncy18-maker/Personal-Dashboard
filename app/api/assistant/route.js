import { route } from '../../../lib/route';
import { runAssistant } from '../../../lib/assistant';

// App-wide AI Assistant (CLAUDE.md §7). The client posts the full raw message
// history (Anthropic block form) plus the new user text; this handler runs the
// Sonnet tool loop server-side — tools fetch this app's own api routes on the
// same origin — and returns the new turns for the client to append and resend
// next time. Conversation state lives entirely in the browser tab; nothing is
// persisted server-side.
export const maxDuration = 300;

const MAX_HISTORY_MESSAGES = 60;

export const POST = route(async (request) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  if (!messages || messages.length === 0) {
    return Response.json({ error: 'messages is required' }, { status: 400 });
  }
  if (messages[messages.length - 1]?.role !== 'user') {
    return Response.json(
      { error: 'last message must be from the user' },
      { status: 400 }
    );
  }

  // Bound the resent history so a marathon chat can't blow up the request.
  // Trim from the front, but never split an assistant tool_use from its
  // tool_result turn (start the window on a plain user text turn).
  let trimmed = messages;
  if (messages.length > MAX_HISTORY_MESSAGES) {
    let start = messages.length - MAX_HISTORY_MESSAGES;
    while (
      start < messages.length &&
      !(
        messages[start].role === 'user' &&
        typeof messages[start].content === 'string'
      )
    ) {
      start++;
    }
    trimmed = messages.slice(start);
  }

  const origin = new URL(request.url).origin;
  const result = await runAssistant({ messages: trimmed, origin });
  return Response.json(result);
});
