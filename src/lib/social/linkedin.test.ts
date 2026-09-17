import { it, expect, vi, afterEach } from "vitest";
vi.mock("server-only", () => ({}));
import { sendLinkedIn } from "./linkedin";
afterEach(() => vi.unstubAllGlobals());
it("publishes only the supplied author and exact body and captures provider ID", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(null, {
        status: 201,
        headers: { "x-restli-id": "urn:li:share:12345" },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(
    await sendLinkedIn("secret-token", "person123", "Approved exact text"),
  ).toEqual({ ok: true, id: "urn:li:share:12345" });
  const [url, request] = fetcher.mock.calls[0];
  expect(url).toBe("https://api.linkedin.com/v2/ugcPosts");
  const body = JSON.parse(request.body);
  expect(body.author).toBe("urn:li:person:person123");
  expect(
    body.specificContent["com.linkedin.ugc.ShareContent"].shareCommentary.text,
  ).toBe("Approved exact text");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not retry timeout or accept a missing post identifier", async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error("timeout"));
  vi.stubGlobal("fetch", fetcher);
  await expect(sendLinkedIn("token", "person", "text")).rejects.toThrow(
    "timeout",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
  fetcher.mockResolvedValue(new Response(null, { status: 201 }));
  expect(await sendLinkedIn("token", "person", "text")).toEqual({
    ok: false,
    status: 502,
  });
});
