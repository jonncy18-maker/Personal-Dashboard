import { createAuthCode } from '../../../../../lib/health-oauth';

// The authorization endpoint. Since this app has no user accounts, "signing
// in" is just typing the same HEALTH_MCP_TOKEN that /api/mcp/health has
// always required — this page is the only new UI in the whole OAuth
// handshake, everything else is a redirect or a JSON response.
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

function renderPage({ values, error }) {
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
<title>Personal Dashboard — Health</title>
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
  <h1>Connect to Health › Diet</h1>
  <p>Enter your Health MCP token (from Vercel's <code>HEALTH_MCP_TOKEN</code>) to allow this connection.</p>
  ${error ? `<p class="err">${escapeHtml(error)}</p>` : ''}
  <form method="POST">
    ${hidden}
    <input type="password" name="token" placeholder="Health MCP token" autofocus required autocomplete="off">
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;
}

export async function GET(request) {
  const url = new URL(request.url);
  return new Response(renderPage({ values: url.searchParams }), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request) {
  const form = await request.formData();
  const secret = process.env.HEALTH_MCP_TOKEN;
  const redirectUri = form.get('redirect_uri');

  if (!secret) {
    return new Response(
      renderPage({
        values: form,
        error: 'Server not configured — HEALTH_MCP_TOKEN is unset in Vercel.',
      }),
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }
  if (!redirectUri) {
    return new Response('missing redirect_uri', { status: 400 });
  }

  if (form.get('token') !== secret) {
    return new Response(
      renderPage({ values: form, error: 'That token is not correct.' }),
      { headers: { 'content-type': 'text/html; charset=utf-8' } }
    );
  }

  const code = await createAuthCode({
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
