import { describe, it, expect } from "vitest";
import {
  redact,
  normalizeMetrics,
  scoreOpportunity,
  validateGeneration,
  defaultProfile,
  editDistance,
  type Atom,
} from "./domain";
const atom: Atom = {
  id: "atom-1",
  source_id: "source-1",
  summary: "Customer education",
  excerpt: "Document ownership before handoffs",
  topics: ["Customer education"],
  roles: [],
  confidence: 0.9,
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  external_use: "approved_fact",
};
const output = () => ({
  platform: "linkedin",
  objective: "Educate",
  audience: "Teams",
  topic: "Ownership",
  brief: "A useful lesson",
  variants: [1, 2, 3].map((n) => ({
    body: `I work at Acme. Document ownership before handoffs. Option ${n}.`,
    rationale: "Grounded in a source",
    sourceIds: ["source-1"],
    atomIds: ["atom-1"],
    claimChecks: [
      { claim: "Document ownership", evidence: atom.excerpt, supported: true },
    ],
    riskFlags: [],
    voiceScore: 0.8,
  })),
});
describe("Content engine output boundaries", () => {
  it("removes common contact details and credentials", () => {
    expect(
      redact(
        "Email jane@example.com or call 212-555-1212. sk-12345678901234567890",
      ),
    ).not.toMatch(/jane@|212-555|sk-/);
  });
  it("keeps unknown metrics unknown and rejects negative values", () => {
    expect(normalizeMetrics({ impressions: "100", revenue: "" })).toMatchObject(
      { impressions: 100, revenue: null, leads: null },
    );
    expect(() => normalizeMetrics({ clicks: -1 })).toThrow();
  });
  it("ranks relevant, fresh, novel evidence above stale repeats", () => {
    const now = Date.now();
    expect(
      scoreOpportunity(atom, defaultProfile, [], 0, now).overall,
    ).toBeGreaterThan(
      scoreOpportunity(
        { ...atom, created_at: "2020-01-01" },
        defaultProfile,
        [atom.summary],
        0,
        now,
      ).overall,
    );
  });
  it("rejects fabricated evidence, duplicates, missing disclosure and platform mismatch", () => {
    expect(
      validateGeneration(output(), [atom], "Acme", "linkedin", []).variants,
    ).toHaveLength(3);
    const bad = output();
    bad.variants[0].sourceIds = ["unknown"];
    expect(() =>
      validateGeneration(bad, [atom], "Acme", "linkedin", []),
    ).toThrow("Invalid evidence");
    const duplicate = output();
    duplicate.variants[1].body = duplicate.variants[0].body;
    expect(() =>
      validateGeneration(duplicate, [atom], "Acme", "linkedin", []),
    ).toThrow("Duplicate");
    expect(() =>
      validateGeneration(output(), [atom], "Other company", "linkedin", []),
    ).toThrow("Disclosure");
    expect(() => validateGeneration(output(), [atom], "Acme", "x", [])).toThrow(
      "Platform",
    );
  });
  it("flags ungrounded claims and restricted phrases", () => {
    const raw = output();
    raw.variants[0].claimChecks[0].evidence = "Invented number";
    const checked = validateGeneration(raw, [atom], "Acme", "linkedin", [
      "Option 2",
    ]);
    expect(checked.variants.reduce((n, v) => n + v.riskFlags.length, 0)).toBe(
      2,
    );
  });
  it("validates the requested quantity from one to ten", () => {
    for (const count of [1, 10]) {
      const raw = output();
      raw.variants = Array.from({ length: count }, (_, n) => ({
        ...raw.variants[0],
        body: `I work at Acme. Distinct thought ${n}.`,
      }));
      expect(
        validateGeneration(raw, [atom], "Acme", "linkedin", [], count).variants,
      ).toHaveLength(count);
      expect(() =>
        validateGeneration(
          raw,
          [atom],
          "Acme",
          "linkedin",
          [],
          count === 1 ? 10 : 1,
        ),
      ).toThrow("Incorrect draft count");
    }
  });
  it("measures edits without keeping a second copy of text", () => {
    expect(editDistance("same text", "same text")).toBe(0);
    expect(editDistance("a b", "c d")).toBe(1);
  });
});
