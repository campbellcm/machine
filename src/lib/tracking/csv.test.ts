import { it, expect } from "vitest";
import { csvCell, toCsv } from "./csv";
it("escapes quotes and prevents spreadsheet formula execution", () => {
  expect(csvCell('=HYPERLINK("https://example.com")')).toBe(
    '"\'=HYPERLINK(""https://example.com"")"',
  );
  expect(csvCell(" normal")).toBe('" normal"');
  expect(csvCell(" \t+SUM(A1)")).toBe('"\' \t+SUM(A1)"');
  expect(
    toCsv([
      ["a", "b"],
      ["one", "two"],
    ]),
  ).toContain("\r\n");
});
