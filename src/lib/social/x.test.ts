import { it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { sendX } from "./x";
afterEach(() => vi.unstubAllGlobals());
it("sends the exact approved X text and accepts only a valid returned ID", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "12345" } }), { status: 201 }),
    );
  vi.stubGlobal("fetch", request);
  expect(await sendX("test-token", "Approved exact text")).toEqual({
    ok: true,
    id: "12345",
  });
  expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({
    text: "Approved exact text",
  });
  expect(request.mock.calls[0][0]).toBe("https://api.x.com/2/tweets");
  request.mockResolvedValue(
    new Response(JSON.stringify({ data: { id: "malformed" } }), {
      status: 201,
    }),
  );
  expect(await sendX("test-token", "text")).toEqual({ ok: false, status: 502 });
});
it("does not retry ambiguous X delivery", async () => {
  const request = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", request);
  await expect(sendX("test-token", "text")).rejects.toThrow();
  expect(request).toHaveBeenCalledTimes(1);
});
