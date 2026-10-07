import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { createRpsClient } from '../rps';
import { createMondayClient } from '../monday';
import type { Client } from '@modelcontextprotocol/client';
import {
  mcpTools,
  type MCPClientLike,
  type MCPCallToolResultLike,
} from '@anthropic-ai/sdk/helpers/beta/mcp';
import { anthropicRequestCost, type RequestCost } from '@/lib/costs/anthropic';

const BOARD_ID = 1151042058;

// The only monday.com tools the agent is given. Everything else is filtered out.
const MONDAY_TOOLS = ['change_item_column_values'];

const system = `You complete tasks from the user's monday.com board.

The user's message lists the open tasks on board ${BOARD_ID}. For each task:
- Do what the task asks, using your tools. If a tool result shows you haven't succeeded yet, keep trying.
- When the task is complete, set its status to Done with change_item_column_values: boardId ${BOARD_ID}, the task's itemId, and columnValues {"status": {"label": "Done"}}.
- Don't change any other column, item or board.
- If a task can't be done with your tools, leave it unchanged and explain why.

When finished, summarize what you completed and anything you skipped.`;

type BoardItem = {
  id: string;
  name: string;
  column_values: { status: string | null };
};

function toMcpClientLike(client: Client): MCPClientLike {
  return {
    callTool: (params) =>
      client.callTool(params) as Promise<MCPCallToolResultLike>,
  };
}

// Fetched in code rather than by the agent: this step is always the same, so it
// doesn't need a model turn, and we can trim the data to just what the agent needs.
async function getOpenTasks(monday: Client) {
  const result = await monday.callTool({
    name: 'get_board_items_page',
    arguments: { boardId: BOARD_ID, includeColumns: true },
  });
  const { items } = result.structuredContent as { items: BoardItem[] };

  return items
    .filter((item) => item.column_values.status !== 'Done')
    .map((item) => ({
      itemId: item.id,
      task: item.name,
      status: item.column_values.status,
    }));
}

type ModelConfig = Pick<
  Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
  'model' | 'output_config' | 'thinking'
>;

const claudeOpus55: ModelConfig = {
  model: 'claude-opus-5-5',
  output_config: { effort: 'medium' },
};
const claudeHaiki45: ModelConfig = {
  model: 'claude-haiku-4-5-20251001',
  //thinking: { type: 'adaptive' }
};

export async function runAnthropicAgent(prompt: string) {
  const requests: RequestCost[] = [];
  const client = new Anthropic();
  const rps = await createRpsClient();
  const monday = await createMondayClient();
  try {
    const tasks = await getOpenTasks(monday);
    const mondayTools = (await monday.listTools()).tools.filter((tool) =>
      MONDAY_TOOLS.includes(tool.name),
    );

    const runner = client.beta.messages.toolRunner({
      ...claudeHaiki45,
      max_tokens: 16000,
      cache_control: { type: 'ephemeral' },
      system,
      tools: [
        ...mcpTools((await rps.listTools()).tools, toMcpClientLike(rps)),
        ...mcpTools(mondayTools, toMcpClientLike(monday)),
      ],
      max_iterations: 20,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nOpen tasks:\n${JSON.stringify(tasks, null, 2)}`,
        },
      ],
    });

    for await (const message of runner) {
      const cost = anthropicRequestCost(message);
      requests.push(cost);
      console.log(
        `request ${requests.length}: in ${cost.inputTokens}, out ${cost.outputTokens}` +
          ` (thinking ${cost.thinkingTokens}), $${cost.costUsd?.toFixed(4) ?? '?'}`,
      );

      for (const block of message.content) {
        if (block.type === 'tool_use')
          console.log('→', block.name, block.input);
        if (block.type === 'text') console.log(block.text);
      }
    }

    const final = await runner.done();
    console.log('stop_reason:', final.stop_reason);
    return final;
  } catch (error) {
    console.error(error);
  } finally {
    await rps.close();
    await monday.close();
  }
}
