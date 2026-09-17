import { createProtectedResourceMetadataHandler } from '../../../lib/mcp-server';

// Root-level fallback for an MCP client that checks the origin's well-known
// path without a resource-specific suffix. Points at the app-wide server
// (app/api/mcp/app) since that's the more general of the two MCP resources
// this app exposes — Health's own path-scoped metadata at
// .well-known/oauth-protected-resource/api/mcp/health is unaffected.
export const GET = createProtectedResourceMetadataHandler('/api/mcp/app');
