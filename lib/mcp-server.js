import crypto from 'node:crypto';
import {
  withBypass,
  protectedResourceMetadata,
  authorizationServerMetadata,
  createAuthCode,
  consumeAuthCode,
} from './mcp-oauth';

// Shared shape for every MCP server this app exposes (Health, the app-wide
// one). One JSON-RPC 2.0 transport, one bearer-token gate, one OAuth wrapper
// — factored here so a new server is a tools list + a callTool function, not
// a second copy of this plumbing. See lib/mcp-oauth.js for why the OAuth
// wrapper exists and what it does and doesn't change.

const PROTOCOL_VERSION = '2025-06-18';

function rpc(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function rpcError(id, code, message) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } });
}

// MCP tool failures are reported inside a successful result with isError,
// not as a JSON-RPC error — the model needs to read them and correct itself.
export function toolText(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

// Builds the main POST handler: bearer auth (fails closed — an internet-
// reachable, unauthenticated write path is a materially different risk than
// this project's other machine endpoints, e.g. the CRON_SECRET gate, which
// may run unauthenticated because a stray GET only costs a scan) plus the
// initialize/tools-list/tools-call trio MCP clients need.
export function createMcpHandler({
  tokenEnvVar,
  resourcePath,
  serverName,
  tools,
  callTool,
  instructions,
}) {
  return async function POST(request) {
    const secret = process.env[tokenEnvVar];
    if (!secret) {
      console.error(`[${serverName}] ${tokenEnvVar} is not set — refusing`);
      return Response.json({ error: 'server not configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      // RFC 9728: pointing an OAuth client at its resource metadata here is
      // what lets it discover the /authorize, /token and /register endpoints
      // below on its own, instead of needing them hardcoded.
      const { origin } = new URL(request.url);
      const resourceMetadataUrl = withBypass(
        `${origin}/.well-known/oauth-protected-resource${resourcePath}`
      );
      return Response.json(
        { error: 'unauthorized' },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadataUrl}"`,
          },
        }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return rpcError(null, -32700, 'Parse error');
    }
    const { id = null, method, params = {} } = body || {};
    const { origin } = new URL(request.url);

    try {
      if (method === 'initialize') {
        return rpc(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: serverName, version: '1.0.0' },
          ...(instructions ? { instructions } : {}),
        });
      }
      // Notifications carry no id and expect no response body.
      if (method === 'notifications/initialized') {
        return new Response(null, { status: 202 });
      }
      if (method === 'tools/list') {
        return rpc(id, { tools });
      }
      if (method === 'tools/call') {
        const result = await callTool(params.name, params.arguments || {}, {
          origin,
        });
        return rpc(id, result);
      }
      return rpcError(id, -32601, `Method not found: ${method}`);
    } catch (err) {
      console.error(`[${serverName}] tool call failed:`, err);
      return rpcError(id, -32603, 'Internal error');
    }
  };
}

const OAUTH_PARAMS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'state',
  'code_challenge',
  'code_challenge_method',
  'scope',
];

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]
  );
}

function renderAuthorizePage({ title, values, error }) {
  const hidden = OAUTH_PARAMS.filter((key) => values.get(key) != null)
    .map(
      (key) =>
        `<input type="hidden" name="${key}" value="${escapeHtml(values.get(key))}">`
    )
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Personal Dashboard</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 380px;
         margin: 90px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  p { font-size: 13.5px; color: #555; line-height: 1.5; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: 11px 12px;
    font-size: 15px; margin: 14px 0; border: 1px solid #ccc; border-radius: 6px; }
  button { width: 100%; padding: 11px; font-size: 14px; font-weight: 600;
    background: #111; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
  .err { color: #c0392b; font-size: 13px; margin: -6px 0 4px; }
</style>
</head>
<body>
  <h1>Connect to ${escapeHtml(title)}</h1>
  <p>Enter the token to allow this connection.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <form method="POST">
    ${hidden}
    <input type="password" name="token" placeholder="Token" autofocus required autocomplete="off">
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;
}

// The authorization endpoint. Since this app has no user accounts, "signing
// in" is just typing the same bearer secret the MCP route already requires
// — this page is the only new UI in the whole OAuth handshake, everything
// else is a redirect or a JSON response.
export function createAuthorizeHandlers({ tokenEnvVar, title }) {
  async function GET(request) {
    const url = new URL(request.url);
    return new Response(
      renderAuthorizePage({ title, values: url.searchParams }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  async function POST(request) {
    const form = await request.formData();
    const secret = process.env[tokenEnvVar];
    const redirectUri = form.get('redirect_uri');

    if (!secret) {
      return new Response(
        renderAuthorizePage({
          title,
          values: form,
          error: `Server not configured — ${tokenEnvVar} is unset in Vercel.`,
        }),
        { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }
    if (!redirectUri) {
      return new Response('missing redirect_uri', { status: 400 });
    }
    if (form.get('token') !== secret) {
      return new Response(
        renderAuthorizePage({
          title,
          values: form,
          error: 'That token is not correct.',
        }),
        { headers: { 'content-type': 'text/html; charset=utf-8' } }
      );
    }

    const code = await createAuthCode({
      server: tokenEnvVar,
      codeChallenge: form.get('code_challenge'),
      codeChallengeMethod: form.get('code_challenge_method'),
      redirectUri,
    });

    const dest = new URL(redirectUri);
    dest.searchParams.set('code', code);
    const state = form.get('state');
    if (state != null) dest.searchParams.set('state', state);
    return Response.redirect(dest.toString(), 302);
  }

  return { GET, POST };
}

async function parseTokenRequestBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

// The token endpoint. Deliberately issues the server's own bearer secret as
// both access_token and refresh_token — see lib/mcp-oauth.js's header
// comment. The MCP route's own bearer check never has to know OAuth exists.
export function createTokenHandler(tokenEnvVar) {
  return async function POST(request) {
    const secret = process.env[tokenEnvVar];
    if (!secret) {
      return Response.json(
        { error: 'server_error', error_description: `${tokenEnvVar} not set` },
        { status: 503 }
      );
    }

    const body = await parseTokenRequestBody(request);

    if (body.grant_type === 'refresh_token') {
      if (body.refresh_token !== secret) {
        return Response.json({ error: 'invalid_grant' }, { status: 400 });
      }
      return Response.json({
        access_token: secret,
        token_type: 'Bearer',
        refresh_token: secret,
      });
    }

    if (body.grant_type !== 'authorization_code') {
      return Response.json(
        { error: 'unsupported_grant_type' },
        { status: 400 }
      );
    }

    const ok = await consumeAuthCode({
      server: tokenEnvVar,
      code: body.code,
      codeVerifier: body.code_verifier,
    });
    if (!ok) {
      return Response.json({ error: 'invalid_grant' }, { status: 400 });
    }

    return Response.json({
      access_token: secret,
      token_type: 'Bearer',
      refresh_token: secret,
    });
  };
}

// Dynamic client registration (RFC 7591). Nothing here is persisted or
// checked later: every server here has exactly one real credential (its
// bearer token, verified at /authorize), so a client_id exists only to
// satisfy the wire format, not to distinguish callers.
export async function registerHandler(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Some clients register with an empty body — fine, not an error.
  }
  return Response.json(
    {
      client_id: crypto.randomBytes(12).toString('hex'),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      redirect_uris: body.redirect_uris || [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: body.client_name || 'MCP client',
    },
    { status: 201 }
  );
}

export function createProtectedResourceMetadataHandler(resourcePath) {
  return async function GET(request) {
    const { origin } = new URL(request.url);
    return Response.json(protectedResourceMetadata(origin, resourcePath));
  };
}

export function createAuthorizationServerMetadataHandler(resourcePath) {
  return async function GET(request) {
    const { origin } = new URL(request.url);
    return Response.json(authorizationServerMetadata(origin, resourcePath));
  };
}
