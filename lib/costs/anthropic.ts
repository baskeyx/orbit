import type Anthropic from '@anthropic-ai/sdk';
import { PRICES } from './pricing';

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

export function anthropicRequestCost(
  message: Anthropic.Beta.BetaMessage,
): RequestCost {
  const u = message.usage;
  const cacheWrite1hTokens = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;

  const tokens = {
    provider: 'anthropic' as const,
    model: message.model,
    inputTokens: u.input_tokens,
    outputTokens: u.output_tokens,
    thinkingTokens: u.output_tokens_details?.thinking_tokens ?? 0,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens:
      (u.cache_creation_input_tokens ?? 0) - cacheWrite1hTokens,
    cacheWrite1hTokens,
  };

  const p = PRICES[message.model];
  const costUsd = p
    ? (tokens.inputTokens * p.input +
        tokens.outputTokens * p.output +
        tokens.cacheReadTokens * p.cacheRead +
        tokens.cacheWrite5mTokens * p.cacheWrite5m +
        tokens.cacheWrite1hTokens * p.cacheWrite1h) /
      1_000_000
    : null;

  return { ...tokens, costUsd };
}
