import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, workspace, ready, processJob, allow } = vi.hoisted(() => ({
  rpc: vi.fn(),
  workspace: vi.fn(),
  ready: vi.fn(),
  processJob: vi.fn(),
  allow: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ workspace }));
vi.mock("@/lib/content-engine/service", () => ({
  engineReady: ready,
  processEngineJob: processJob,
}));
vi.mock("@/lib/security/rate-limit", () => ({ allowRequest: allow }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "./route";
const id = "b4e35e52-9efb-4d0c-8da1-dbb7a6a7d4e1";
const request = (
  instruction = "Write about clear handoffs",
  origin = "https://example.test",
) =>
  new Request("https://example.test/workspace/ai/engine", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      operation: "chat",
      input: { id, key: id, instruction },
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  workspace.mockResolvedValue({
    db: { rpc },
    org: { id: "org" },
    user: { id: "person" },
  });
  rpc.mockResolvedValue({ data: { ok: true, id }, error: null });
  ready.mockReturnValue(true);
  allow.mockResolvedValue(true);
  processJob.mockResolvedValue(undefined);
});
describe("topic chat endpoint", () => {
  it("queues through the authorized generation command before attempting OpenAI work", async () => {
    const result = await POST(request());
    expect(result.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("ce_command", {
      org: "org",
      operation: "generate",
      input: { id, key: id, instruction: "Write about clear handoffs" },
    });
    expect(processJob).toHaveBeenCalledWith(id);
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      processJob.mock.invocationCallOrder[0],
    );
  });
  it("does not run a job if permissions or generation limits reject it", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "generation limit reached" },
    });
    expect((await POST(request())).status).toBe(400);
    expect(processJob).not.toHaveBeenCalled();
  });
  it("blocks a cross-origin request and empty topic", async () => {
    expect(
      (await POST(request("topic", "https://elsewhere.test"))).status,
    ).toBe(403);
    expect((await POST(request("   "))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not queue when OpenAI is unconfigured", async () => {
    ready.mockReturnValue(false);
    expect((await POST(request())).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("redacts contact data before persisting a topic instruction", async () => {
    await POST(request("Write about a request from buyer@example.com"));
    expect(rpc.mock.calls[0][1].input.instruction).not.toContain(
      "buyer@example.com",
    );
  });
  it("retains the durable job when the immediate attempt cannot finish", async () => {
    processJob.mockRejectedValue(new Error("transient failure"));
    expect(await (await POST(request())).json()).toEqual({ ok: true, id });
  });
});
