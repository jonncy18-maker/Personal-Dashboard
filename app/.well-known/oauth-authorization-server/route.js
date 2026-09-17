import { authorizationServerMetadata } from '../../../lib/health-oauth';

// Root-level fallback — see the sibling oauth-protected-resource/route.js
// comment for why this duplicates the path-suffixed version.
export async function GET(request) {
  const { origin } = new URL(request.url);
  return Response.json(authorizationServerMetadata(origin));
}
