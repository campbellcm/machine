import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProfile, defaultStrategy } from "./domain";
const { rpc, parse } = vi.hoisted(() => ({ rpc: vi.fn(), parse: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ serviceDatabase: () => ({ rpc }) }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import { processEngineJob } from "./service";
const context = {
  job: { kind: "generate", lease: "lease", payload: {} },
  profile: defaultProfile,
  strategy: { ...defaultStrategy, enabled: true },
  preferences: {},
  recent: [],
  company: "Acme",
  opportunity: { title: "Ownership", rationale: "Role relevant" },
  evidence: [
    {
      id: "a",
      source_id: "s",
      summary: "Ownership",
      excerpt: "Document project ownership",
      topics: ["Ownership"],
      roles: [],
      confidence: 1,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      external_use: "approved_fact",
    },
  ],
  irrelevant_private_secret: "PRIVATE_SENTINEL",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("OPENAI_CONTENT_MODEL", "configured-test-model");
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "ce_claim"
        ? { data: structuredClone(context), error: null }
        : { data: true, error: null },
    ),
  );
});
describe("Content preparation service", () => {
  it("sends only approved context and saves three validated variants without publishing", async () => {
    parse.mockResolvedValue({
      status: "completed",
      output_parsed: {
        platform: "linkedin",
        objective: "Educate",
        audience: "Teams",
        topic: "Ownership",
        brief: "Lesson",
        variants: [1, 2, 3].map((n) => ({
          body: `I work at Acme. Document project ownership. Option ${n}.`,
          rationale: "Evidence",
          sourceIds: ["s"],
          atomIds: ["a"],
          claimChecks: [],
          riskFlags: [],
          voiceScore: 0.8,
        })),
      },
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    await processEngineJob("job");
    const input = parse.mock.calls[0][0];
    expect(input.store).toBe(false);
    expect(input.input).not.toContain("PRIVATE_SENTINEL");
    expect(input.input).not.toContain("test-key");
    expect(input.input).toContain("Document project ownership");
    expect(rpc.mock.calls[1][0]).toBe("ce_finish");
    expect(rpc.mock.calls[1][1].result.variants).toHaveLength(3);
    expect(rpc.mock.calls.some((c) => /publish/.test(c[0]))).toBe(false);
  });
  it("records sanitized provider failures without saving unvalidated draft text", async () => {
    parse.mockRejectedValue(
      new Error("provider error including PRIVATE_SENTINEL"),
    );
    await processEngineJob("job");
    const finish = rpc.mock.calls[1][1];
    expect(finish.failure).toBe("generation_failed");
    expect(JSON.stringify(finish)).not.toContain("PRIVATE_SENTINEL");
    expect(finish.result).toEqual({});
  });
  it("makes no provider request when access was revoked before claim", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await processEngineJob("job");
    expect(parse).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
