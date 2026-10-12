// Provider-neutral cost records, shared by every agent.

export type RequestCost = {
  provider: 'anthropic' | 'openai';
  model: string;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  costUsd: number | null; // null if the model isn't in PRICES
};

export type RunSummary = {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number | null; // null if any request couldn't be priced
};
