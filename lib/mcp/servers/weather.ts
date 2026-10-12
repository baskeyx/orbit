import { getForecast } from '@/lib/weather/openMeteo';
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { timeWindowSchema } from './time-window';

const server = new McpServer({
  name: 'weather',
  version: '1.0.0',
});

const hourSchema = z.object({
  time: z.string().describe('The hour, ISO 8601 UTC'),
  temperatureC: z.number(),
  rainChance: z.number().describe('Chance of rain, %'),
  rainMm: z.number().describe('Rain over the hour before `time`, mm'),
  windMph: z.number(),
  weatherCode: z.number().describe('WMO weather code, e.g. 0 = clear, 61 = light rain'),
});

server.registerTool(
  'get_weather_forecast',
  {
    description:
      'Hourly weather forecast at Clissold Park between start and end, both hours included. Covers about the next 15 days; hours beyond that are left out, so an empty list means no forecast yet, not good weather. Times are UTC.',
    inputSchema: timeWindowSchema,
    outputSchema: z.object({ hours: z.array(hourSchema) }),
  },
  async ({ start, end }) => {
    const hours = (await getForecast(new Date(start), new Date(end))).map((hour) => ({
      ...hour,
      time: hour.time.toISOString(),
    }));
    const result = { hours };
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
