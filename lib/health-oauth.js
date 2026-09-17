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

// This Vercel project has "Vercel Authentication" (its own login wall,
// separate from HEALTH_MCP_TOKEN) on for every *.vercel.app URL — it's what
// keeps the whole app from being publicly browsable with no in-app login,
// per CLAUDE.md §7.1 ("gate access at the Vercel project level"). That wall
// sits in front of EVERYTHING, including claude.ai's OAuth calls, which is
// what actually broke the connector (confirmed via zero Vercel runtime logs
// for any request to these routes — the calls never got past the wall to
// reach our code at all).
//
// Vercel's "Protection Bypass for Automation" is the sanctioned narrow hole:
// once turned on in the project's Deployment Protection settings, Vercel
// auto-provisions VERCEL_AUTOMATION_BYPASS_SECRET, and a request carrying
// that secret in an `x-vercel-protection-bypass` query param skips the wall
// for just that request. We stamp it onto every URL WE generate here, so the
// wall stays up for ordinary browsing but this one handshake can get through.
// It can't cover the very first request (whichever URL John pastes into
// claude.ai's connector setup) — that one has to carry the secret already,
// which is a one-time manual step on his side.
export function withBypass(url) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return url;
  const u = new URL(url);
  u.searchParams.set('x-vercel-protection-bypass', secret);
  u.searchParams.set('x-vercel-set-bypass-cookie', 'true');
  return u.toString();
}

export function protectedResourceMetadata(origin) {
  const resource = `${origin}/api/mcp/health`;
  // RFC 9728 requires this to be a clean issuer identifier — no query string
  // — so it can't carry the bypass secret directly (an earlier version did
  // this and it silently broke discovery: the client never even attempted
  // the next hop). The 401's WWW-Authenticate header already put the bypass
  // secret + `x-vercel-set-bypass-cookie=true` on THIS document's own URL, so
  // Vercel should have already set a bypass cookie by the time the client
  // reads this — that cookie, not a query param, is what has to get the
  // client past the wall for the authorization-server metadata fetch below.
  return { resource, authorization_servers: [resource] };
}

export function authorizationServerMetadata(origin) {
  const issuer = `${origin}/api/mcp/health`;
  return {
    issuer,
    authorization_endpoint: withBypass(`${origin}/api/mcp/health/authorize`),
    token_endpoint: withBypass(`${origin}/api/mcp/health/token`),
    registration_endpoint: withBypass(`${origin}/api/mcp/health/register`),
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
