import { runAnthropicAgent } from '@/lib/mcp/agents/anthropic';

export async function GET() {
  const { final, requests, summary, error } =
    await runAnthropicAgent('Complete my tasks.');

  if (!final) {
    return Response.json(
      { success: false, error, summary, requests },
      { status: 500 },
    );
  }

  return Response.json({
    success: true,
    content: final.content,
    stopReason: final.stop_reason,
    summary,
    requests,
  });
}
