import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ verified: true, rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  serviceDatabase: () => ({
    rpc: state.rpc,
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              email: "author@example.com",
              email_confirmed_at: state.verified ? "2026-09-18" : null,
            },
          },
        }),
      },
    },
  }),
}));
import { deliverDraftNotice } from "./worker";
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  state.verified = true;
  state.rpc.mockReset().mockImplementation(async (name: string) => ({
    data:
      name === "claim_draft_delivery"
        ? {
            id,
            organization_id: id,
            user_id: id,
            channel: "email",
            lease: id,
          }
        : true,
  }));
  vi.stubEnv("RESEND_API_KEY", "test");
  vi.stubEnv("EMAIL_FROM", "Drafts <drafts@example.com>");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("delivers a generic private inbox link only to the verified author with a stable key", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "receipt" })));
  vi.stubGlobal("fetch", fetcher);
  await deliverDraftNotice(id);
  const [url, request] = fetcher.mock.calls[0];
  expect(url).toBe("https://api.resend.com/emails");
  expect(request.headers["Idempotency-Key"]).toBe("draft-delivery/" + id);
  const body = JSON.parse(request.body);
  expect(body.to).toEqual(["author@example.com"]);
  expect(body.text).toContain(
    "https://app.example.com/draft-inbox?org=11111111-1111-4111-8111-111111111111",
  );
  expect(Object.keys(body).sort()).toEqual(["from", "subject", "text", "to"]);
  expect(state.rpc).toHaveBeenLastCalledWith("finish_draft_delivery", {
    delivery: id,
    claim: id,
    outcome: "sent",
  });
});
it("does not notify an unverified email", async () => {
  state.verified = false;
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await deliverDraftNotice(id);
  expect(fetcher).not.toHaveBeenCalled();
  expect(state.rpc).toHaveBeenLastCalledWith("finish_draft_delivery", {
    delivery: id,
    claim: id,
    outcome: "failed",
  });
});
it("records an interrupted send as uncertain without retrying", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await deliverDraftNotice(id);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenLastCalledWith("finish_draft_delivery", {
    delivery: id,
    claim: id,
    outcome: "uncertain",
  });
});
