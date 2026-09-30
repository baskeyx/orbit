import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

export async function createMondayClient() {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) throw new Error('MONDAY_API_TOKEN is not set');
  const client = new Client({
    name: 'orbit',
    version: '0.1.0',
  });

  const transport = new StreamableHTTPClientTransport(
    new URL('https://mcp.monday.com/mcp'),
    {
      authProvider: { token: async () => token },
    },
  );

  await client.connect(transport);

  return client;
}
