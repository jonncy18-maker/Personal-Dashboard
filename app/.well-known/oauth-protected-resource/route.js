import { protectedResourceMetadata } from '../../../lib/health-oauth';

// Root-level fallback for MCP clients that check the origin's well-known
// path without the resource's own path suffix. Only one resource exists in
// this app today, so this and the path-suffixed version return the same
// thing — add a real dispatch here if a second OAuth-gated resource ever
// shows up.
export async function GET(request) {
  const { origin } = new URL(request.url);
  return Response.json(protectedResourceMetadata(origin));
}
