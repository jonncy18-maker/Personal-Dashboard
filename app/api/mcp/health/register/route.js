import crypto from 'node:crypto';

// Dynamic client registration (RFC 7591) — the step claude.ai's connector UI
// was failing at ("Couldn't register with sign-in service"). Nothing here is
// persisted or checked later: this app has exactly one real credential
// (HEALTH_MCP_TOKEN, verified at /authorize), so a client_id exists only to
// satisfy the wire format, not to distinguish callers.
export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    // Some clients register with an empty body — that's fine, not an error.
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
