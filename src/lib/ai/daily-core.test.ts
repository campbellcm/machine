import { describe, it, expect } from "vitest";
import { dailyInput, validateDailyOutput } from "./daily-core";
const valid = {
  drafts: [1, 2, 3].map((n) => ({
    body: `I work at Acme. Useful idea ${n}.`,
    claims_to_verify: [],
  })),
};
describe("daily draft boundaries", () => {
  it("requires consent, real timezone, and bounded source context", () => {
    const value = {
      provider: "openai",
      channel: "x",
      timezone: "America/New_York",
      hour: 9,
      context: "Approved context for our company",
      consent: "on",
    };
    expect(dailyInput.safeParse(value).success).toBe(true);
    expect(dailyInput.safeParse({ ...value, consent: "" }).success).toBe(false);
    expect(
      dailyInput.safeParse({ ...value, timezone: "Not/A_Zone" }).success,
    ).toBe(false);
    expect(dailyInput.safeParse({ ...value, hour: 24 }).success).toBe(false);
  });
  it("rejects unsupported claims shape, duplicate options, missing disclosure and blocked phrases", () => {
    expect(validateDailyOutput(valid, "Acme", "x", [])).toHaveLength(3);
    expect(() =>
      validateDailyOutput(valid, "Another company", "x", []),
    ).toThrow();
    expect(() => validateDailyOutput(valid, "Acme", "x", ["Useful"])).toThrow();
    expect(() =>
      validateDailyOutput(
        { drafts: Array(3).fill(valid.drafts[0]) },
        "Acme",
        "x",
        [],
      ),
    ).toThrow();
    expect(() =>
      validateDailyOutput(
        { drafts: valid.drafts.slice(0, 2) },
        "Acme",
        "x",
        [],
      ),
    ).toThrow();
  });
  it("limits X drafts including their disclosure", () => {
    const long = {
      drafts: valid.drafts.map((d) => ({
        ...d,
        body: d.body + "a".repeat(280),
      })),
    };
    expect(() => validateDailyOutput(long, "Acme", "x", [])).toThrow();
    expect(validateDailyOutput(long, "Acme", "linkedin", [])).toHaveLength(3);
  });
});
