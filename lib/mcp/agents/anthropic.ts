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

const system = 'Please complete the tasks from the Monday board';

function toMcpClientLike(client: Client): MCPClientLike {
  return {
    callTool: (params) =>
      client.callTool(params) as Promise<MCPCallToolResultLike>,
  };
}

export async function runAnthropicAgent(prompt: string) {
  const client = new Anthropic();
  const rps = await createRpsClient();
  const monday = await createMondayClient();
  try {
    const runner = client.beta.messages.toolRunner({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      system,
      tools: [
        ...mcpTools((await rps.listTools()).tools, toMcpClientLike(rps)),
        ...mcpTools((await monday.listTools()).tools, toMcpClientLike(monday)),
      ],
      max_iterations: 20,
      messages: [{ role: 'user', content: prompt }],
    });

    for await (const message of runner) {
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
