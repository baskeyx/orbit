import { getBusyTimes } from '@/lib/calendar/google';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { timeWindowSchema } from './time-window';

const server = new McpServer({
  name: 'calendar',
  version: '1.0.0',
});

const busyTimeSchema = z.object({
  start: z.string().describe('Start of a busy period, ISO 8601 UTC'),
  end: z.string().describe('End of a busy period, ISO 8601 UTC'),
});

server.registerTool(
  'get_busy_times',
  {
    description:
      'List the times the user is busy in their Google Calendar between start and end. Any time not covered by a busy period is free. Events marked "Free" (e.g. birthdays) are not included. Times are UTC.',
    inputSchema: timeWindowSchema,
    outputSchema: z.object({ busyTimes: z.array(busyTimeSchema) }),
  },
  async ({ start, end }) => {
    const busyTimes = (await getBusyTimes(new Date(start), new Date(end))).map(
      (busy) => ({
        start: busy.start.toISOString(),
        end: busy.end.toISOString(),
      }),
    );
    const result = { busyTimes };
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
