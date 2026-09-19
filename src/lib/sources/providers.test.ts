import { afterEach, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchFathom, fetchSlackMessage, slackMessageRef } from "./providers";
afterEach(() => vi.unstubAllGlobals());
it("drops Fathom speaker metadata and fetches only the requested recording", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        transcript: [
          {
            speaker: {
              display_name: "Private Person",
              matched_calendar_invitee_email: "private@example.com",
            },
            text: "Shared checklists can clarify who owns the next step.",
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", f);
  expect(await fetchFathom("test-key", "123")).toBe(
    "Shared checklists can clarify who owns the next step.",
  );
  expect(f.mock.calls[0][0]).toBe(
    "https://api.fathom.ai/external/v1/recordings/123/transcript",
  );
  expect(f.mock.calls[0][1].redirect).toBe("error");
});
it("rejects private channels and non-Slack links before fetching", () => {
  expect(() =>
    slackMessageRef("https://example.com/archives/C123/p1234567890123456"),
  ).toThrow();
  expect(() =>
    slackMessageRef("https://team.slack.com/archives/G123/p1234567890123456"),
  ).toThrow();
  expect(
    slackMessageRef("https://team.slack.com/archives/C123/p1234567890123456"),
  ).toEqual({ channel: "C123", ts: "1234567890.123456" });
});
it("does not substitute a nearby Slack message when the selected one is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            channel: {
              id: "C123",
              is_private: false,
              is_im: false,
              is_mpim: false,
            },
          }),
        ),
      )
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: true,
            messages: [{ ts: "1234567890.123455", text: "Different message" }],
          }),
        ),
      ),
  );
  await expect(
    fetchSlackMessage(
      "token",
      "https://team.slack.com/archives/C123/p1234567890123456",
    ),
  ).rejects.toThrow("Selected message unavailable");
});
it("rejects private Slack channels even when their ID begins with C", async () => {
  const f = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        channel: {
          id: "C123",
          is_private: true,
          is_im: false,
          is_mpim: false,
        },
      }),
    ),
  );
  vi.stubGlobal("fetch", f);
  await expect(
    fetchSlackMessage(
      "token",
      "https://team.slack.com/archives/C123/p1234567890123456",
    ),
  ).rejects.toThrow("public channel");
  expect(f).toHaveBeenCalledTimes(1);
});
