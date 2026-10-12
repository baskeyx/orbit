import * as z from 'zod/v4';

// The start/end window tools take, shared so every server's input is identical
// and the agent can pass the same window to each. All times are UTC, which never
// changes with the clocks, so nothing needs updating between GMT and BST.
export const timeWindowSchema = z
  .object({
    start: z.iso
      .datetime({ offset: true })
      .describe('Start of the window, ISO 8601 UTC, e.g. 2026-10-09T17:00:00Z'),
    end: z.iso
      .datetime({ offset: true })
      .describe('End of the window, ISO 8601 UTC, e.g. 2026-10-09T21:00:00Z'),
  })
  // An inverted window would otherwise return nothing, which reads as "free".
  .refine(({ start, end }) => new Date(start) < new Date(end), {
    message: 'end must be after start',
  });
