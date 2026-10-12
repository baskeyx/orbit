import { runAnthropicTennisAgent } from '@/lib/mcp/agents/tennis-agent';

export async function GET() {
  const now = new Date();
  const today = now.toLocaleString('en-GB', {
    timeZone: 'Europe/London',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const prompt = 'Complete my tasks';

  const { final, requests, summary, error } = await runAnthropicTennisAgent(
    `${prompt}, it is now ${today} in London (${now.toISOString()} UTC).`,
  );

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
