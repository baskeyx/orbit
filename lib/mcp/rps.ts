import 'server-only';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export async function createRpsClient() {
  const client = new Client({ name: 'orbit', version: '0.1.0' });

  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'lib/mcp/rps-server.ts'],
    cwd: process.cwd(),
  });

  await client.connect(transport);
  return client;
}
