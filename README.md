# Orbit

A Next.js app experimenting with AI agents that complete real tasks using [MCP](https://modelcontextprotocol.io) (Model Context Protocol) tools.

The first working example: an agent reads a ticket on a monday.com board, works out what it asks for, completes it with the tools it has, and marks the ticket as done. Nothing about the task itself is written in code; the agent decides how to complete it.

## Demo

The monday.com board has one ticket, **"Win one hand of rock, paper, scissors"**, with status _Not Started_:

![monday.com board before the agent runs](public/monday-board-before.png)

Calling `GET /api/agent` with the prompt _"Complete my tasks."_:

1. The app fetches the board's open tasks from monday.com and passes them to the agent.
2. The agent calls the `play` tool from our own rock-paper-scissors MCP server, and keeps playing until it wins.
3. The agent sets the ticket's status to **Done** using monday.com's `change_item_column_values` tool.

The API response from the first version's run:

> Your only task is done. The Baskey board had one item: **"Win one hand of rock, paper, scissors."**
>
> - **The game:** It took four hands to get a win. I lost the first three (rock vs. paper, scissors vs. rock, paper vs. scissors), then won with rock vs. scissors.
> - **The board:** I changed the item's status from "Not Started" to **Done**.

And the board afterwards:

![monday.com board after the agent runs, with the ticket marked Done](public/monday-board-after.png)

## Installation

### Requirements

- Node.js 20.9 or later
- [pnpm](https://pnpm.io) (the project pins `pnpm@10.31.0` via `packageManager`)
- A [monday.com](https://monday.com) account and API token
- An [Anthropic API key](https://platform.claude.com)

### Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a `.env` file in the project root:

   ```bash
   MONDAY_API_TOKEN=your-monday-api-token
   ANTHROPIC_API_KEY=your-anthropic-api-key
   ```

   `.env*` files are gitignored. Neither variable has a `NEXT_PUBLIC_` prefix, so both stay on the server and are never sent to the browser.

3. Set `BOARD_ID` in `lib/mcp/agents/anthropic.ts` to your monday.com board's ID. It's the number in the board's URL.

4. Start the dev server:

   ```bash
   pnpm dev
   ```

5. Run the agent by opening [http://localhost:3000/api/agent](http://localhost:3000/api/agent). The final response is returned as JSON. Every tool call and the token count and cost of every request are logged in the terminal running `pnpm dev`.

The agent only works on tasks whose status isn't _Done_, so set the ticket back to _Not Started_ between runs.

## How it works

```
Orbit (MCP host)
├── Anthropic Tool Runner ── Claude (claude-haiku-4-5)
├── MCP client ──stdio──► lib/mcp/rps-server.ts   (our rock-paper-scissors server)
└── MCP client ──HTTP───► mcp.monday.com/mcp      (monday.com's hosted server)
```

The app is the MCP **host**. It holds one MCP **client** per server, collects the tools the agent needs, and gives them to Claude. The Anthropic SDK's Tool Runner then runs the agent loop: Claude asks for a tool, the runner calls it through the right MCP client and sends back the result, and this repeats until Claude is finished.

Before the loop starts, the app fetches the board's open tasks itself. That step is always the same, so it doesn't need the model. See [Cost optimisation](#cost-optimisation) for why.

### Project structure

| File | Purpose |
|---|---|
| `lib/mcp/rps-server.ts` | An MCP server exposing a `play` tool. Uses `StdioServerTransport`, so it runs as a standalone process and communicates over stdin/stdout. |
| `lib/mcp/rps.ts` | MCP client for the RPS server. `StdioClientTransport` launches `rps-server.ts` as a child process with `npx tsx`. |
| `lib/mcp/monday.ts` | MCP client for monday.com's hosted server, over Streamable HTTP, authenticated with `MONDAY_API_TOKEN` as a bearer token. |
| `lib/mcp/agents/anthropic.ts` | The agent. Fetches the open tasks, filters monday.com's tools down to an allowlist, and runs Claude through `client.beta.messages.toolRunner()`, logging each request's cost. |
| `lib/costs/pricing.ts` | Per-model token prices in USD per million tokens. |
| `lib/costs/anthropic.ts` | Turns a response's `usage` into a provider-neutral `RequestCost` record with a dollar amount. |
| `app/api/agent/route.ts` | `GET /api/agent`, which runs the agent with the prompt _"Complete my tasks."_ |
| `app/page.tsx` | Scratch page used while building: lists monday.com's tools and plays one RPS hand on every load. |

### The rock-paper-scissors server

Game rules live in a single `BEATS` map (each choice maps to the choice it beats), so a result is just a lookup:

```ts
function getResult(p1: Choice, p2: Choice): Result {
  if (p1 === p2) return 'tie';
  return BEATS[p1] === p2 ? 'p1' : 'p2';
}
```

The `play` tool's input schema is `z.enum(choices)`, which does two things: `choice` is typed as `Choice` inside the handler, and invalid input such as `"banana"` is rejected before the handler runs.

### Agent configuration

The main Tool Runner parameters in `lib/mcp/agents/anthropic.ts`:

| Parameter | Value | Why |
|---|---|---|
| `model` | `claude-haiku-4-5-20251001` | A quarter of Opus 5.5's price per token, and enough for a task this simple. Switch models by spreading a different config (`claudeOpus55` or `claudeHaiki45`). |
| `max_tokens` | `16000` | Thinking counts toward this limit; too low a value cuts responses off mid-thought. |
| `system` | Standing instructions | How the agent works: which board, the exact arguments for setting a status to Done, and not to change anything else. It's the same on every run. |
| `messages` | The user prompt + open tasks | What to do on this run. The tasks change between runs, so they go here rather than in `system`. |
| `tools` | RPS `play` + `change_item_column_values` | Only the tools this task needs. See [Cost optimisation](#cost-optimisation). |
| `cache_control` | `{ type: 'ephemeral' }` | Prompt caching. Later requests read the repeated prefix at a fraction of the input price. |
| `max_iterations` | `20` | Guardrail: caps the number of API requests so a bug can't loop forever. |

Haiku 4.5 doesn't support `output_config.effort`, so only the Opus config sets it. Sending it to Haiku returns a 400 error.

## Cost optimisation

### Version 1: Opus 5.5 with every monday.com tool

The first version used `claude-opus-5-5` and passed the agent **every** tool monday.com's MCP server offers. It worked, but each request cost about **$0.33**, and a full run cost up to **$4**.

The task itself was cheap. The `play` tool runs locally and costs nothing. The cost came from the tool definitions:

- monday.com's server exposes **98 tools**, and their definitions come to **91,067 tokens**, measured with the token counting endpoint. The largest single definition, `update_doc`, is about 20,000 characters.
- The API is stateless, so **every request in the loop resends the whole context**: system prompt, all tool definitions and the conversation so far.
- A run makes about 10–12 requests (find the board, a request per game, update the status, summarise). Each one resent ~91K tokens of tool definitions the agent never used, at $4 per million input tokens: about $0.36 per request.

So almost the whole bill was the model rereading 98 tool descriptions on every turn.

### Version 2: Haiku 4.5, only the tools needed, board fetched in code

| Change | Effect |
|---|---|
| **Filter monday.com's tools to an allowlist** (`MONDAY_TOOLS`) | The agent only gets `change_item_column_values` (~1,450 tokens) instead of all 98 tools (~91K tokens), resent on every request. It also stops the agent reaching tools like `execute_code` or `all_api_write`. |
| **Fetch the board in code** (`getOpenTasks()`) | Fetching the board is always the same step, so it doesn't need a model turn. That saves a request, drops `get_board_items_page`'s ~3,000-token definition, and lets the code trim the data to just item ID, task name and status. |
| **Put the status column details in the system prompt** | The agent doesn't need `get_board_info` (~1,375 tokens) to look up the column ID and labels. |
| **Turn on prompt caching** | The repeated prefix is read from the cache at a fraction of the normal input price. Prompts below a model-specific minimum length aren't cached. |
| **Switch to Haiku 4.5** | $1 / $5 per million input/output tokens, against Opus 5.5's $4 / $20. |

### Lessons

- **Tool definitions are resent on every request.** A large toolset costs money on every turn, whether or not the agent uses it. Only give an agent the tools its task needs.
- **Use the model for judgment and code for fixed steps.** If a step would be a simple function call or `if` in code, doing it before the loop is cheaper and more reliable than spending a model turn on it.
- **Compare models on cost per completed task, not price per token.** A cheaper model that takes more turns or fails part of the time can cost more overall.
- **Measure before optimising.** The per-request cost log made the problem obvious, and the token counting endpoint showed exactly where the tokens were going.

### How costs are tracked

Every response includes a `usage` object with the exact token counts it's billed on: uncached input, cache writes, cache reads and output (which includes thinking). `anthropicRequestCost()` multiplies these by the prices in `lib/costs/pricing.ts`, so each request is logged with its token counts and dollar cost.

The API doesn't return prices, so `pricing.ts` has to be kept up to date by hand. Check it against [Anthropic's pricing page](https://platform.claude.com/docs/en/about-claude/pricing), and compare totals with the Claude Console's usage page now and then. The calculation assumes standard-tier pricing; batch and fast mode are priced differently.

## Testing tools manually

Inspect and call the RPS server's tools in a browser UI with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx tsx lib/mcp/rps-server.ts
```

Or call a tool from code through an MCP client:

```ts
const client = await createRpsClient();
try {
  const result = await client.callTool({ name: 'play', arguments: { choice: 'rock' } });
  console.log(result);
} finally {
  await client.close();
}
```

## Notes and gotchas

- **Never `console.log` in a stdio MCP server.** stdout is the protocol channel, so a stray log line breaks the connection. Use `console.error` instead.
- **Each client launches a new process.** Every `createRpsClient()` starts a fresh `rps-server.ts` process, so always call `client.close()` (in a `finally` block) to shut it down. This also means the stdio setup only works where the app can spawn processes (local dev or your own server), not on serverless hosting.
- **SDK type mismatch.** The Anthropic SDK's `mcpTools()` helper types its client argument as `MCPClientLike`, which was written for the older MCP SDK. The v2 `Client`'s `callTool()` result types `structuredContent` as `unknown`, so TypeScript rejects it even though it works at runtime. `toMcpClientLike()` in `lib/mcp/agents/anthropic.ts` wraps the client with a narrow cast.
- **Model configs need the SDK's types.** Moving parameters like `output_config: { effort: 'medium' }` into a separate object widens `'medium'` to `string`, which `toolRunner()` rejects. The `ModelConfig` type keeps the exact values.
- **`zod/v4` is an import path, not a package name.** Install `zod` (`pnpm add zod`). `pnpm add zod/v4` is read as a GitHub repo shorthand.
- **Ticket text is data, not instructions.** The agent does what tickets say, so anyone who can create tickets on the board can direct it. The `system` prompt asks the agent to stay on one board and one column, but `change_item_column_values` would still accept any board or column.

## Next steps

- Measure version 2's cost per run and compare it with version 1.
- Run each model several times (Opus 5.5 at `medium` and `low`, Sonnet 5.5, Haiku 4.5) and compare success rate and cost per completed task.
- Replace `change_item_column_values` with a small wrapper tool that only sets this board's status column, so the restriction is enforced in code rather than just requested in the prompt.
- Return each run's costs from `/api/agent` and save them, so runs can be compared over time.
- Try the same MCP servers with an OpenAI agent to compare providers.
- Move `rps-server.ts` to Streamable HTTP so it can be deployed and connected to by URL.
