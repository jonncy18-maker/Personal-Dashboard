import crypto from 'node:crypto';
import { getDb } from './db';

// OAuth 2.1 handshake for the Health MCP server. See migration 029's comment
// for why this exists: claude.ai's hosted "Add custom connector" flow
// requires OAuth + dynamic client registration per the MCP spec, and
// /api/mcp/health's hand-rolled bearer token doesn't speak that. This module
// is the minimum needed to satisfy that flow WITHOUT inventing a second
// credential: the token this hands back at the end is HEALTH_MCP_TOKEN
// itself, so the route's existing check never changes.
//
// Client IDs are not tracked or validated anywhere in this flow. The real
// gate is the token typed into the /authorize page — a client_id here exists
// only because the OAuth wire format requires one, not because this app
// distinguishes between clients.

const CODE_TTL_MS = 5 * 60 * 1000; // short-lived, single-use

export function protectedResourceMetadata(origin) {
  const resource = `${origin}/api/mcp/health`;
  return { resource, authorization_servers: [resource] };
}

export function authorizationServerMetadata(origin) {
  const issuer = `${origin}/api/mcp/health`;
  return {
    issuer,
    authorization_endpoint: `${origin}/api/mcp/health/authorize`,
    token_endpoint: `${origin}/api/mcp/health/token`,
    registration_endpoint: `${origin}/api/mcp/health/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
  };
}

export async function createAuthCode({
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
      (code, code_challenge, code_challenge_method, redirect_uri, expires_at)
    VALUES (${code}, ${codeChallenge || null}, ${codeChallengeMethod || 'S256'},
            ${redirectUri}, ${expiresAt})
  `;
  return code;
}

// Single-use by construction: DELETE ... RETURNING both consumes the row and
// hands back what it held, so a replayed code always finds nothing.
export async function consumeAuthCode({ code, codeVerifier }) {
  if (!code) return false;
  const sql = getDb();
  const [row] = await sql`
    DELETE FROM health_mcp_auth_codes WHERE code = ${code} RETURNING *
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
