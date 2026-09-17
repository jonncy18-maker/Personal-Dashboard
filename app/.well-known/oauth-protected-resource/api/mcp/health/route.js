import { protectedResourceMetadata } from '../../../../../../lib/health-oauth';

// RFC 9728 protected-resource metadata, at the path-suffixed location the MCP
// auth spec expects for a resource that isn't the whole origin.
export async function GET(request) {
  const { origin } = new URL(request.url);
  return Response.json(protectedResourceMetadata(origin));
}
