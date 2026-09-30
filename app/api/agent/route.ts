import { runAnthropicAgent } from '@/lib/mcp/agents/anthropic';

export async function GET() {
  const final = await runAnthropicAgent('Complete my tasks.');
  return Response.json(final ? final.content : { success: false });
}
