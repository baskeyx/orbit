import 'server-only';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

export async function createStdioClient(server: string) {
  const client = new Client({ name: 'orbit', version: '0.1.0' });
  await client.connect(
    new StdioClientTransport({
      command: 'npx',
      args: ['tsx', `lib/mcp/servers/${server}.ts`],
      cwd: process.cwd(),
    }),
  );
  return client;
}
