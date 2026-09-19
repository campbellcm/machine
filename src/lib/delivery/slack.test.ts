import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { sendSlackNotice, exchangeSlack } from "./slack";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("addresses the authorized user directly without link previews", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
  vi.stubGlobal("fetch", fetcher);
  expect(await sendSlackNotice("token", "U123", "Private inbox link")).toBe(
    true,
  );
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    channel: "U123",
    text: "Private inbox link",
    unfurl_links: false,
    unfurl_media: false,
  });
});
it("rejects OAuth responses without the required bot message scope", async () => {
  vi.stubEnv("SLACK_CLIENT_ID", "id");
  vi.stubEnv("SLACK_CLIENT_SECRET", "secret");
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", "key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            access_token: "token",
            scope: "channels:read",
            team: { id: "T123" },
            authed_user: { id: "U123" },
          }),
        ),
      ),
  );
  await expect(exchangeSlack("code")).rejects.toThrow(
    "Message permission required",
  );
});
