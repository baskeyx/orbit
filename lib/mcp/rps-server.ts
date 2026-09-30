import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const server = new McpServer({
  name: 'rock-paper-scissors-server',
  version: '1.0.0',
});

type Choice = 'rock' | 'paper' | 'scissors';
type Result = 'p1' | 'p2' | 'tie';

const BEATS: Record<Choice, Choice> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

const choices: Choice[] = Object.keys(BEATS) as Choice[];

function getResult(p1: Choice, p2: Choice): Result {
  if (p1 === p2) return 'tie';
  return BEATS[p1] === p2 ? 'p1' : 'p2';
}

const playHand = (choice: Choice) => {
  const opponent: Choice = choices[Math.floor(Math.random() * choices.length)];
  const result: string = getResult(choice, opponent);
  const outcome: string =
    result === 'tie' ? "It's a tie" : result === 'p1' ? 'You Win' : 'You Lose';
  return { outcome, opponent };
};

server.registerTool(
  'play',
  {
    description: 'Play a hand of rock, paper, scissors',
    inputSchema: z.object({ choice: z.enum(choices) }),
  },
  async ({ choice }) => {
    const { opponent, outcome } = playHand(choice);

    return {
      content: [
        {
          type: 'text',
          text: `Your played: ${choice}, opponent played: ${opponent}. ${outcome}`,
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
