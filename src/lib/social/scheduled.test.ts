import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const calls = vi.hoisted(() => ({
  filters: [] as [string, unknown][],
  updates: 0,
}));
vi.mock("@/lib/supabase/server", () => ({
  serviceDatabase: () => ({
    from: () => {
      let updating = false;
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => {
          if (updating) calls.filters.push([key, value]);
          return chain;
        },
        lte: () => chain,
        order: () => chain,
        limit: async () => ({
          data: [
            {
              id: "job",
              draft_id: "draft",
              organization_id: "org",
              user_id: "user",
              revision: 3,
              run_at: "2026-09-18T10:00:00Z",
            },
          ],
        }),
        single: async () => ({ data: { channel: "linkedin" } }),
        update: () => {
          updating = true;
          calls.updates++;
          return chain;
        },
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
      };
      return chain;
    },
  }),
}));
vi.mock("./connection", () => ({
  connectionToken: async () => {
    throw new Error("Reconnect");
  },
  recordConnectionCheck: vi.fn(),
  providerIssue: vi.fn(),
}));
import { runScheduledPosts } from "./scheduled";
it("fails only the schedule generation observed before a connection error", async () => {
  await runScheduledPosts();
  expect(calls.updates).toBe(1);
  expect(calls.filters).toEqual(
    expect.arrayContaining([
      ["id", "job"],
      ["status", "pending"],
      ["revision", 3],
      ["run_at", "2026-09-18T10:00:00Z"],
    ]),
  );
});
