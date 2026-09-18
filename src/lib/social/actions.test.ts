import { it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  send: vi.fn(),
  record: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/security/rate-limit", () => ({
  allowRequest: async () => true,
}));
vi.mock("@/lib/supabase/server", () => ({
  workspace: async () => ({
    db: { rpc: mocks.rpc },
    user: { id: "user" },
    org: { id: "org" },
  }),
  serviceDatabase: () => ({ rpc: mocks.rpc, from: mocks.from }),
}));
vi.mock("./x", () => ({ xConfig: () => ({}), sendX: mocks.send }));
vi.mock("./linkedin", () => ({
  linkedinConfig: () => ({}),
  sendLinkedIn: mocks.send,
}));
vi.mock("./connection", () => ({
  ConnectionError: class extends Error {},
  connectionToken: async () => ({
    token: "access",
    encrypted: "cipher",
    providerPerson: "person",
  }),
  providerIssue: () => "reconnect",
  recordConnectionCheck: mocks.record,
  verifyConnection: vi.fn(),
}));
import { publishLinkedIn } from "./actions";
afterEach(() => vi.clearAllMocks());
it("does not overwrite a new attempt after releasing a definitively rejected publish", async () => {
  mocks.rpc
    .mockResolvedValueOnce({ data: "Approved post" })
    .mockResolvedValueOnce({ data: true });
  mocks.send.mockResolvedValue({ ok: false, status: 401 });
  const f = new FormData();
  f.set("channel", "x");
  f.set("confirmed", "on");
  f.set("revision", "1");
  f.set("id", "11111111-1111-4111-8111-111111111111");
  await expect(publishLinkedIn(f)).rejects.toThrow("notice=rejected-reconnect");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "reject_publish_attempt",
    expect.objectContaining({ expected_revision: 1 }),
  );
  expect(mocks.from).not.toHaveBeenCalled();
});
