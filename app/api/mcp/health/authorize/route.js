import { createAuthorizeHandlers } from '../../../../../lib/mcp-server';

export const { GET, POST } = createAuthorizeHandlers({
  tokenEnvVar: 'HEALTH_MCP_TOKEN',
  title: 'Health › Food',
});
