// Consistent error handling for API route handlers. External-source routes
// (github/vercel/gmail/calendar) already fail soft on their own; these CRUD
// handlers wrap their DB work so an unexpected throw returns a JSON 500 the
// client can parse — not an opaque framework error page that breaks a
// `res.json()` on the client. Validation errors still return their own
// explicit 400/404 from inside the handler; only unexpected throws hit here.

export function jsonError(message, status = 500) {
  return Response.json({ error: message }, { status });
}

export function route(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (err) {
      console.error('[api] unhandled error:', err);
      return jsonError('Internal server error', 500);
    }
  };
}
