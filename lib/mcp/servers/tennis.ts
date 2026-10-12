import { getTennisSessions, tennisSessionSchema } from '@/lib/tennis/clubspark';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { timeWindowSchema } from './time-window';

const server = new McpServer({
  name: 'tennis',
  version: '1.0.0',
});

server.registerTool(
  'get_tennis_sessions',
  {
    description:
      'List adult tennis sessions at Clissold Park with places left that start between start and end. Times are UTC.',
    inputSchema: timeWindowSchema,
    outputSchema: z.object({ sessions: z.array(tennisSessionSchema) }),
  },
  async ({ start, end }) => {
    const sessions = await getTennisSessions(new Date(start), new Date(end));
    const result = { sessions };
    return {
      structuredContent: result,
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// stdout is the MCP channel, so errors go to stderr.
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
