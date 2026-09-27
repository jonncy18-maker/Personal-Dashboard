// ChatGPT's custom-connector setup requires the MCP endpoint URL to literally
// end in `/mcp` (a hard requirement of its connector UI, unrelated to the
// MCP spec itself) — `/api/mcp/app` doesn't satisfy that, so this route
// exists purely as a second, ChatGPT-shaped URL for the exact same handler.
// No new tool catalog, no new auth logic: same APP_MCP_TOKEN bearer check,
// same tools. ChatGPT's own "Access token / API key" connector mode sends
// that same bearer header on every request, so no OAuth wrapper is needed
// here the way claude.ai's connector required one — see the `assistant`
// skill for why. See ROADMAP.md's 2026-09-27 entry for the full story.
export { POST } from '../../mcp/app/route';
