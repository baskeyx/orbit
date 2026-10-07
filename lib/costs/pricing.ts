// USD per million tokens. Check against https://platform.claude.com/docs/en/about-claude/pricing
// Standard tier only. Batch and fast mode are priced differently.
export type Price = {
  input: number;
  output: number;
  cacheWrite5m: number; // 1.25× input
  cacheWrite1h: number; // 2× input
  cacheRead: number;
};

export const PRICES: Record<string, Price> = {
  'claude-opus-5-5': {
    input: 4,
    output: 20,
    cacheWrite5m: 5,
    cacheWrite1h: 8,
    cacheRead: 0.2,
  },
  'claude-sonnet-5-5': {
    input: 2,
    output: 10,
    cacheWrite5m: 2.5,
    cacheWrite1h: 4,
    cacheRead: 0.2,
  },
  'claude-haiku-4-5-20251001': {
    input: 1,
    output: 5,
    cacheWrite5m: 1.25,
    cacheWrite1h: 2,
    cacheRead: 0.1,
  },
};
