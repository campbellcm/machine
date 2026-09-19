import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  serviceDatabase: () => ({ rpc: state.rpc }),
}));
vi.mock("./worker", () => ({
  emailDeliveryReady: () => true,
  sendPrivateNotice: state.send,
}));
import { deliverWeeklyDigest } from "./weekly";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  state.send.mockReset().mockResolvedValue("sent");
  state.rpc
    .mockReset()
    .mockImplementation(async (name: string) => ({
      data:
        name === "claim_weekly_digest"
          ? {
              id,
              organization_id: id,
              user_id: id,
              channel: "email",
              lease: id,
              summary: {
                from: "2026-09-07T00:00:00Z",
                until: "2026-09-14T00:00:00Z",
                posts: 4,
                participants: 2,
                clicks: 9,
                leads: 1,
                top_post: { url: "https://x.com/i/status/123", clicks: 6 },
              },
            }
          : true,
    }));
});
afterEach(() => vi.unstubAllEnvs());
it("sends measured totals, a safe shared post, limitations and the correct workspace link", async () => {
  await deliverWeeklyDigest();
  const text = state.send.mock.calls[0][2];
  expect(text).toContain("2 participants shared 4 posts");
  expect(text).toContain("9 unique tracked clicks");
  expect(text).toContain("https://x.com/i/status/123");
  expect(text).toContain("view=home");
  expect(text).toContain("attributed outcomes do not establish causation");
  expect(state.rpc).toHaveBeenLastCalledWith("finish_weekly_digest", {
    delivery: id,
    claim: id,
    outcome: "sent",
  });
});
it("does not send without a fresh eligible claim", async () => {
  state.rpc.mockResolvedValue({ data: null });
  await deliverWeeklyDigest();
  expect(state.send).not.toHaveBeenCalled();
});
it("persists uncertain outcomes without a second attempt", async () => {
  state.send.mockResolvedValue("uncertain");
  await deliverWeeklyDigest();
  expect(state.send).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenLastCalledWith("finish_weekly_digest", {
    delivery: id,
    claim: id,
    outcome: "uncertain",
  });
});
