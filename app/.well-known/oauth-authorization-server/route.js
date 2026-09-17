import { createAuthorizationServerMetadataHandler } from '../../../lib/mcp-server';

// Root-level fallback — see the sibling oauth-protected-resource/route.js
// comment for why this points at the app-wide server.
export const GET = createAuthorizationServerMetadataHandler('/api/mcp/app');
