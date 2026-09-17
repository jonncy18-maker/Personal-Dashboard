import { createAuthorizeHandlers } from '../../../../../lib/mcp-server';

export const { GET, POST } = createAuthorizeHandlers({
  tokenEnvVar: 'APP_MCP_TOKEN',
  title: 'Personal Dashboard',
});
