vi.mock("server-only",()=>({}));
import { it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptToken, decryptToken, secureEqual } from "./tokens";
it("encrypts with random nonces, authenticates tenant and detects corruption", () => {
  const key = randomBytes(32).toString("base64");
  const a = encryptToken("private-token", key, "org:user:linkedin");
  expect(a).not.toContain("private-token");
  expect(a).not.toBe(encryptToken("private-token", key, "org:user:linkedin"));
  expect(decryptToken(a, key, "org:user:linkedin")).toBe("private-token");
  expect(() => decryptToken(a, key, "other:user:linkedin")).toThrow();
  expect(() =>
    decryptToken(a.slice(0, -4) + "AAAA", key, "org:user:linkedin"),
  ).toThrow();
  expect(() => encryptToken("x", "bad", "scope")).toThrow();
});
it("compares callback state exactly", () => {
  expect(secureEqual("abc", "abc")).toBe(true);
  expect(secureEqual("abc", "abcd")).toBe(false);
});
