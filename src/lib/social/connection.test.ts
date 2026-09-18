import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ serviceDatabase: () => ({ rpc }) }));
import { connectionToken, verifyConnection } from "./connection";
import { encryptToken } from "@/lib/security/tokens";
const key = Buffer.alloc(32, 7).toString("base64");
function setup() {
  vi.stubEnv("X_CLIENT_ID", "id");
  vi.stubEnv("X_CLIENT_SECRET", "secret");
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", key);
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  rpc.mockReset();
});
it("rotates once with confidential-client authentication and saves encrypted credentials", async () => {
  setup();
  rpc
    .mockResolvedValueOnce({
      data: {
        kind: "refresh",
        encrypted: encryptToken("refresh", key, "org:person:x:refresh"),
        provider_person: "123",
        lease: "11111111-1111-4111-8111-111111111111",
      },
    })
    .mockResolvedValueOnce({ data: true });
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "new",
          refresh_token: "rotated",
          expires_in: 7200,
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await connectionToken("org", "person", "x")).toMatchObject({
    token: "new",
    providerPerson: "123",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].body.get("grant_type")).toBe("refresh_token");
  expect(rpc.mock.calls[1][1].encrypted).not.toBe("new");
  expect(rpc.mock.calls[1][1].refresh_encrypted).not.toBe("rotated");
});
it("never retries an ambiguous rotation and requires reconnect", async () => {
  setup();
  rpc
    .mockResolvedValueOnce({
      data: {
        kind: "refresh",
        encrypted: encryptToken("refresh", key, "org:person:x:refresh"),
        provider_person: "123",
        lease: "11111111-1111-4111-8111-111111111111",
      },
    })
    .mockResolvedValueOnce({ data: true });
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await expect(connectionToken("org", "person", "x")).rejects.toMatchObject({
    reason: "reconnect",
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(rpc.mock.calls[1][1]).toMatchObject({
    encrypted: null,
    refresh_encrypted: null,
  });
});
it("stops before provider calls while another worker renews", async () => {
  setup();
  rpc.mockResolvedValue({ data: { kind: "busy" } });
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  await expect(connectionToken("org", "person", "x")).rejects.toMatchObject({
    reason: "busy",
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not mark the wrong profile verified", async () => {
  setup();
  rpc
    .mockResolvedValueOnce({
      data: {
        kind: "ready",
        encrypted: encryptToken("access", key, "org:person:x"),
        provider_person: "123",
      },
    })
    .mockResolvedValueOnce({ error: null });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { id: "456" } }))),
  );
  expect(await verifyConnection("org", "person", "x")).toBe("reconnect");
  expect(rpc.mock.calls[1][1].issue).toBe("reconnect");
});
