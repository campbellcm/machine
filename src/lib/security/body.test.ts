import { it, expect } from "vitest";
import { z } from "zod";
import { boundedJson } from "./body";
it("limits streamed bodies even without content-length", async () => {
  await expect(
    boundedJson(
      new Request("https://example.test", {
        method: "POST",
        body: JSON.stringify({ a: "x".repeat(100) }),
      }),
      z.object({ a: z.string() }),
      20,
    ),
  ).rejects.toThrow("too large");
  expect(
    await boundedJson(
      new Request("https://example.test", {
        method: "POST",
        body: '{"a":"ok"}',
      }),
      z.object({ a: z.string() }),
    ),
  ).toEqual({ a: "ok" });
});
