import { it, expect } from "vitest";
import { isBot, visitorHash, destinationUrl } from "./core";
it("excludes preview crawlers", () => {
  expect(isBot("LinkedInBot/1.0")).toBe(true);
  expect(isBot("Slackbot-LinkExpanding")).toBe(true);
  expect(isBot("Mozilla/5.0 Safari/605.1")).toBe(false);
});
it("hashes visitor identity with a monthly rotating salt", () => {
  const key = "k".repeat(32);
  const a = visitorHash("192.0.2.1", "browser", key, new Date("2026-09-01"));
  expect(a).not.toContain("192.0.2");
  expect(a).toBe(
    visitorHash("192.0.2.1", "browser", key, new Date("2026-09-30")),
  );
  expect(a).not.toBe(
    visitorHash("192.0.2.1", "browser", key, new Date("2026-10-01")),
  );
});
it("preserves destination parameters and includes no private program data", () => {
  const url = destinationUrl(
    "https://example.com/demo?product=one",
    "fall",
    "abcdefg",
    "click",
  );
  expect(url.searchParams.get("product")).toBe("one");
  expect(url.searchParams.get("utm_source")).toBe("linkedin");
  expect(url.searchParams.get("cc_click")).toBe("click");
  expect(url.toString()).not.toMatch(/reward|payout|challenge/);
  expect(() => destinationUrl("javascript:alert(1)", "c", "s")).toThrow();
});
