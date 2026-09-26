import crypto from 'node:crypto';
import { getDb } from './db';

// OAuth 2.1 handshake shared by every MCP server this app exposes (Health,
// and the app-wide one — see lib/mcp-server.js). claude.ai's hosted "Add
// custom connector" flow requires OAuth + dynamic client registration per
// the MCP spec; Claude Code's own MCP config takes a bare bearer header
// directly and needs none of this.
//
// This is NOT a second credential per server. The access/refresh token this
// flow ultimately hands back is that server's own bearer secret
// (HEALTH_MCP_TOKEN, APP_MCP_TOKEN, ...) — OAuth here is only a handshake
// proving the caller knows that secret (typed into the /authorize page), not
// a new identity system. Client IDs are not tracked or validated anywhere in
// this flow — the real gate is the token typed into /authorize.
//
// One auth_codes table serves every MCP server here, despite its
// health-flavored name (it predates the app-wide server). Each code records
// the server that issued it (`server`, the token env var name — migration
// 038) and can only be redeemed at that server's /token: without the binding
// a code earned with the Health token was redeemable for the app-wide one
// (Codex audit F03).

const CODE_TTL_MS = 5 * 60 * 1000; // short-lived, single-use

// This Vercel project's own "Vercel Authentication" login wall was turned
// off 2026-09-17 (ROADMAP.md) after this bypass mechanism proved unable to
// carry a client through the full OAuth discovery chain on its own. Kept
// here as a no-op safety net (it only does anything if
// VERCEL_AUTOMATION_BYPASS_SECRET is set) in case the wall ever needs to
// come back for a different reason.
export function withBypass(url) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  return u.toString();
}

export function protectedResourceMetadata(origin, resourcePath) {
  const resource = `${origin}${resourcePath}`;
  // RFC 9728 requires this to be a clean issuer identifier — no query string
  // — so it can never carry the bypass secret directly (see mcp-server.js
  // for where that secret does go).
  return { resource, authorization_servers: [resource] };
}

export function authorizationServerMetadata(origin, resourcePath) {
  const issuer = `${origin}${resourcePath}`;
  return {
    issuer,
    authorization_endpoint: withBypass(`${origin}${resourcePath}/authorize`),
    token_endpoint: withBypass(`${origin}${resourcePath}/token`),
    registration_endpoint: withBypass(`${origin}${resourcePath}/register`),
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export async function createAuthCode({
  server,
  codeChallenge,
  codeChallengeMethod,
  redirectUri,
}) {
  const sql = getDb();
  // Opportunistic sweep so expired, never-redeemed codes don't accumulate —
  // volume here is one login every so often, not worth a cron for.
  await sql`DELETE FROM health_mcp_auth_codes WHERE expires_at < now()`;

  const code = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await sql`
    INSERT INTO health_mcp_auth_codes
      (code, server, code_challenge, code_challenge_method, redirect_uri,
       expires_at)
    VALUES (${code}, ${server}, ${codeChallenge || null},
            ${codeChallengeMethod || 'S256'}, ${redirectUri}, ${expiresAt})
  `;
  return code;
}

// Single-use by construction: DELETE ... RETURNING both consumes the row and
// hands back what it held, so a replayed code always finds nothing. Matching
// on `server` in the same statement means a code presented at the wrong
// server's /token is neither honored nor consumed — it stays valid for the
// server that issued it.
export async function consumeAuthCode({ server, code, codeVerifier }) {
  if (!code || !server) return false;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_mcp_auth_codes
    WHERE code = ${code} AND server = ${server}
    RETURNING *
  `;
  if (!row) return false;
  if (new Date(row.expires_at).getTime() < Date.now()) return false;
  if (!row.code_challenge) return true; // client didn't send PKCE params

  const computed = crypto
    .createHash('sha256')
    .update(codeVerifier || '')
    .digest('base64url');
  return computed === row.code_challenge;
}
