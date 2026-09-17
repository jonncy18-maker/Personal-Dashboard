import { createMcpHandler, toolText } from '../../../../lib/mcp-server';
import { TOOLS, executeTool, houseRules } from '../../../../lib/assistant';

// App-wide MCP server — the whole Personal Dashboard, not just Health, over
// the same claude.ai connector flow that Health's server (app/api/mcp/health)
// already went through. Scoped 2026-09-17 after John asked for exactly this,
// once Health's version proved the OAuth wrapper approach works.
//
// Deliberately reuses rather than reinvents: `TOOLS` and `executeTool` are
// lib/assistant.js's own — the same allowlisted catalog the in-app AI
// Assistant already uses (CLAUDE.md §7 Hard Boundary — same tools, same
// restrictions: read-only Gmail, no direct DB handle, no raw fetch, no
// third-party API call), Health's tools (get_day/log_food/log_weight/
// update_intake_entry/delete_intake_entry) included — `executeTool` itself
// dispatches those straight to lib/health-mcp-tools.js, the exact module
// app/api/mcp/health uses. A claude.ai connection through this server does
// exactly what the in-app Assistant chat already does — no new capability
// was invented for this, and no tool is defined twice. Transport, the
// bearer-token gate, and the OAuth wrapper are all lib/mcp-server.js /
// lib/mcp-oauth.js, the same shared plumbing Health uses.
//
// One real gap: lib/assistant.js's systemPrompt() (house rules, destructive-
// action confirmation, the Idea/Schedules due-date boundary, etc.) is only
// injected inside the in-app runAssistant() Anthropic call — an external MCP
// client's own model never sees it automatically. The `instructions` field
// below is the MCP-native equivalent (most clients surface it to the model
// as context), so those rules travel with the tools here too. Per-tool
// "Destructive — confirm with John first" wording in CATALOG's descriptions
// applies regardless, since tool descriptions are always part of tools/list.
function instructions() {
  return `You are connected to John's Personal Dashboard — a private, single-user planning hub spanning eight domains: Home, AI Projects, Travel (plus PTO Planner), Car (mileage + maintenance), Schedules, Language Learning, Idea Board, Email, and Health › Diet.

Every tool here calls this app's own API routes or database directly, the same as its own UI or in-app AI Assistant would — nothing goes through a third-party API, and no tool can touch Gmail beyond reading it.

${houseRules()}`;
}

async function callTool(name, args, { origin }) {
  const outcome = await executeTool(origin, name, args);
  return toolText(outcome.result, !outcome.ok);
}

export const POST = createMcpHandler({
  tokenEnvVar: 'APP_MCP_TOKEN',
  resourcePath: '/api/mcp/app',
  serverName: 'personal-dashboard-app',
  tools: TOOLS,
  callTool,
  instructions: instructions(),
});
