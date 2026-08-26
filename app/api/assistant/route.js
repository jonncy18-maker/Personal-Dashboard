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

// Screenshots pasted/dropped into the assistant (CLAUDE.md §7 — same
// same-origin-only rule doesn't apply to inline content, but size does:
// Vercel's serverless body-size ceiling is what actually caps this, not a
// choice made here). Kept generous but bounded — a runaway attachment
// shouldn't be able to blow up the request to Anthropic either.
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];
// Plain-text-ish files (txt/csv/markdown) are inlined as a text block by the
// client, not sent as a document block — only a real PDF needs one.
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];
const MAX_BASE64_CHARS = 20_000_000; // ~15MB decoded, per attachment

// A user turn is a safe place to start the resent window only if it's a
// plain text turn (string) or a text+attachment turn (array whose blocks
// are all text/image/document, none of them a tool_result) — starting mid
// tool_use/tool_result pair would desync the conversation.
function isSafeTrimBoundary(message) {
  if (message?.role !== 'user') return false;
  if (typeof message.content === 'string') return true;
  if (!Array.isArray(message.content)) return false;
  return message.content.every((b) =>
    ['text', 'image', 'document'].includes(b?.type)
  );
}

function validateContentBlock(block) {
  if (!block || typeof block !== 'object') return 'invalid content block';
  if (block.type === 'text') {
    if (typeof block.text !== 'string') return 'text block missing text';
    return block.text.length > 500_000 ? 'text block too large' : null;
  }
  if (block.type === 'image' || block.type === 'document') {
    const src = block.source;
    if (!src || src.type !== 'base64') return `${block.type} must be base64`;
    const allowed =
      block.type === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
    if (!allowed.includes(src.media_type)) {
      return `unsupported ${block.type} type: ${src.media_type}`;
    }
    if (typeof src.data !== 'string' || src.data.length > MAX_BASE64_CHARS) {
      return `${block.type} is missing data or too large`;
    }
    return null;
  }
  // tool_use/tool_result/thinking blocks are only ever produced by this
  // server and resent verbatim by the client — no need to validate their
  // shape here, but they're also not attachments, so nothing else to check.
  return null;
}

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
  const last = messages[messages.length - 1];
  if (last?.role !== 'user') {
    return Response.json(
      { error: 'last message must be from the user' },
      { status: 400 }
    );
  }
  if (Array.isArray(last.content)) {
    for (const block of last.content) {
      const err = validateContentBlock(block);
      if (err) return Response.json({ error: err }, { status: 400 });
    }
  }

  // Bound the resent history so a marathon chat can't blow up the request.
  // Trim from the front, but never split an assistant tool_use from its
  // tool_result turn (start the window on a safe user turn boundary).
  let trimmed = messages;
  if (messages.length > MAX_HISTORY_MESSAGES) {
    let start = messages.length - MAX_HISTORY_MESSAGES;
    while (start < messages.length && !isSafeTrimBoundary(messages[start])) {
      start++;
    }
    // If no safe boundary exists in the trimmed tail (a very long run of
    // tool turns), fall back to the untrimmed history rather than slicing
    // to nothing.
    trimmed = start < messages.length ? messages.slice(start) : messages;
  }

  const origin = new URL(request.url).origin;
  const result = await runAssistant({ messages: trimmed, origin });
  return Response.json(result);
});
