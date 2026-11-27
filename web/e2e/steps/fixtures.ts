import { test as base } from "playwright-bdd";

/** Per-scenario state shared between steps. */
export const test = base.extend<{ ctx: { sent: unknown[]; expected: Record<string, unknown>[] } }>({
  // eslint-disable-next-line no-empty-pattern
  ctx: async ({}, use) => use({ sent: [], expected: [] }),
});
