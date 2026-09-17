import { consumeAuthCode } from '../../../../../lib/health-oauth';

async function parseBody(request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

// The token endpoint. Deliberately issues HEALTH_MCP_TOKEN itself as both the
// access_token and refresh_token — see lib/health-oauth.js's header comment.
// /api/mcp/health's own bearer check never has to know OAuth exists.
export async function POST(request) {
  const secret = process.env.HEALTH_MCP_TOKEN;
  if (!secret) {
    return Response.json(
      { error: 'server_error', error_description: 'HEALTH_MCP_TOKEN not set' },
      { status: 503 }
    );
  }

  const body = await parseBody(request);

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
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }

  const ok = await consumeAuthCode({
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
}
