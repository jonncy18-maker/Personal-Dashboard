import { createMcpHandler } from '../../../../lib/mcp-server';
import { HEALTH_TOOLS, callHealthTool } from '../../../../lib/health-mcp-tools';

// MCP server for Health › Diet — the PRIMARY capture path (see ROADMAP.md's
// 2026-09-16 entry). Claude logs food and weight here over a subscription
// that already covers the model cost, instead of the app paying per-meal
// vision calls on ANTHROPIC_API_KEY. The app's own UI is the fallback
// surface.
//
// Everything else — transport, the bearer-token gate, the OAuth wrapper for
// claude.ai's connector — lives in lib/mcp-server.js and lib/mcp-oauth.js,
// shared with the app-wide server at app/api/mcp/app. This file is just the
// tool set (lib/health-mcp-tools.js) plus its own bearer secret
// (HEALTH_MCP_TOKEN, which fails closed if unset — these tools write to the
// database).
export const POST = createMcpHandler({
  tokenEnvVar: 'HEALTH_MCP_TOKEN',
  resourcePath: '/api/mcp/health',
  serverName: 'personal-dashboard-health',
  tools: HEALTH_TOOLS,
  callTool: (name, args) => callHealthTool(name, args),
});
