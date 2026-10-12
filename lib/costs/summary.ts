import type { RequestCost, RunSummary } from './types';

export function summariseRun(requests: RequestCost[]): RunSummary {
  const sum = (pick: (r: RequestCost) => number) =>
    requests.reduce((total, r) => total + pick(r), 0);

  // A missing price makes the total null rather than silently under-reporting it.
  const unpriced = requests.some((r) => r.costUsd === null);

  return {
    requestCount: requests.length,
    inputTokens: sum((r) => r.inputTokens),
    outputTokens: sum((r) => r.outputTokens),
    thinkingTokens: sum((r) => r.thinkingTokens),
    cacheReadTokens: sum((r) => r.cacheReadTokens),
    cacheWriteTokens: sum((r) => r.cacheWrite5mTokens + r.cacheWrite1hTokens),
    costUsd: unpriced ? null : sum((r) => r.costUsd ?? 0),
  };
}
