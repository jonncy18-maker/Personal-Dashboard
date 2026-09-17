-- OAuth handshake for the Health MCP server, so claude.ai's hosted "Add
-- custom connector" flow (which requires OAuth 2.1 + dynamic client
-- registration per the MCP spec) can reach /api/mcp/health.
--
-- This is NOT a second credential to manage. The access/refresh token this
-- flow ultimately hands back is the very same HEALTH_MCP_TOKEN the route
-- already checks — OAuth here is only a handshake that proves the caller
-- knows that secret (typed into the /authorize page), not a new identity
-- system. CLAUDE.md §7.1 ("no auth — don't add it back") is about the
-- user-facing app; this is machine-to-machine authorization for one
-- already-existing shared secret, the same category as the CRON_SECRET gate.
--
-- Only the short-lived authorization code needs server-side state (the code
-- is exchanged for a token from a different request, possibly a different
-- serverless instance, so it can't live in memory). One row per in-flight
-- login; consumed (deleted) on exchange, single-use by construction.
CREATE TABLE IF NOT EXISTS health_mcp_auth_codes (
  code                   text PRIMARY KEY,
  code_challenge         text,
  code_challenge_method  text NOT NULL DEFAULT 'S256',
  redirect_uri           text NOT NULL,
  expires_at             timestamptz NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
);
