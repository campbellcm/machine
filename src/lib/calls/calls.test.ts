import { describe, it, expect } from "vitest";
import { normalizeFathomTranscript } from "./fathom";
import {
  redactKnownDetails,
  checkSampleDraft,
  canCopySampleDraft,
} from "./privacy";
import {
  sampleCalls,
  sampleThemes,
  sampleSensitiveDetails,
  evidenceForTheme,
} from "./demo";

describe("call transcript response contract", () => {
  it("normalizes timestamps and removes speaker metadata, but does not claim text is anonymized", () => {
    const result = normalizeFathomTranscript({
      transcript: [
        {
          speaker: {
            display_name: "Fictional Person",
            matched_calendar_invitee_email: "private@example.test",
          },
          text: "A fictional customer mentioned Northstar Labs.",
          timestamp: "01:02:03",
        },
        {
          speaker: { display_name: "Fictional Person" },
          text: "Next point.",
          timestamp: "01:02:09",
        },
      ],
    });
    expect(result[0]).toEqual({
      id: "segment-1",
      speakerId: "speaker-1",
      startSeconds: 3723,
      text: "A fictional customer mentioned Northstar Labs.",
    });
    expect(result[1].speakerId).toBe("speaker-1");
    expect(JSON.stringify(result)).not.toContain("private@example.test");
    expect(JSON.stringify(result)).not.toContain("Fictional Person");
  });
  it("rejects invalid timestamps, empty and oversized payloads without exposing source values", () => {
    for (const payload of [
      { transcript: [] },
      {
        transcript: [
          {
            speaker: { display_name: "SECRET" },
            text: "PRIVATE",
            timestamp: "00:99:00",
          },
        ],
      },
      {
        transcript: [
          {
            speaker: { display_name: "SECRET" },
            text: "x".repeat(20001),
            timestamp: "00:00:00",
          },
        ],
      },
    ])
      expect(() => normalizeFathomTranscript(payload)).toThrow(
        "Unsupported or oversized transcript response.",
      );
  });
});
describe("bounded sample privacy checks", () => {
  it("masks all annotated identifiers and confidential values in the selected excerpts", () => {
    const result = redactKnownDetails(
      sampleCalls.flatMap((c) => c.excerpts.map((e) => e.text)).join("\n"),
      sampleSensitiveDetails,
    );
    for (const detail of sampleSensitiveDetails)
      expect(result.text.toLowerCase()).not.toContain(
        detail.value.toLowerCase(),
      );
    expect(result.findings.reduce((sum, f) => sum + f.count, 0)).toBe(7);
  });
  it("treats metacharacters as literals and handles overlapping names longest-first", () => {
    const result = redactKnownDetails("A+B Inc. and A+B. a+b inc.", [
      { value: "A+B", kind: "company", replacement: "[company]" },
      { value: "A+B Inc.", kind: "company", replacement: "[full company]" },
    ]);
    expect(result.text).toBe("[full company] and [company]. [full company]");
  });
  it("does not pretend to detect unknown confidential content", () => {
    expect(
      redactKnownDetails("Unlisted company confidential plan", []).text,
    ).toBe("Unlisted company confidential plan");
  });
  it("keeps every prepared draft free of known identifiers while retaining employment disclosure", () => {
    for (const theme of sampleThemes)
      expect(checkSampleDraft(theme.draft, sampleSensitiveDetails)).toEqual([]);
  });
  it("blocks known names, links, contact details and financial amounts reintroduced by editing", () => {
    for (const suffix of [
      "NORTHSTAR LABS",
      "name@example.test",
      "https://example.test/private",
      "$45,000",
      "85%",
    ])
      expect(
        checkSampleDraft(
          `${sampleThemes[0].draft}\n${suffix}`,
          sampleSensitiveDetails,
        ).length,
      ).toBeGreaterThan(0);
  });
  it("blocks an empty, overlong, or undisclosed sample post", () => {
    for (const body of [
      "",
      "I work at Acme. " + "a".repeat(3000),
      "No employment context.",
    ])
      expect(
        checkSampleDraft(body, sampleSensitiveDetails).length,
      ).toBeGreaterThan(0);
  });
  it("requires the exact reviewed revision and rechecks privacy at copy time", () => {
    const body = sampleThemes[0].draft;
    expect(canCopySampleDraft(body, null, sampleSensitiveDetails)).toBe(false);
    expect(canCopySampleDraft(body, body, sampleSensitiveDetails)).toBe(true);
    expect(
      canCopySampleDraft(body + " More.", body, sampleSensitiveDetails),
    ).toBe(false);
    expect(
      canCopySampleDraft(
        body + " Northstar Labs",
        body + " Northstar Labs",
        sampleSensitiveDetails,
      ),
    ).toBe(false);
  });
});
describe("sample evidence selection", () => {
  it("returns only supporting excerpts from selected calls", () => {
    const evidence = evidenceForTheme(sampleThemes[0], [sampleCalls[0]]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].callId).toBe("call-onboarding");
    expect(evidence[0].speaker).toBe("Customer");
    expect(evidence[0].text).not.toContain("Northstar");
    expect(evidenceForTheme(sampleThemes[0], [])).toEqual([]);
  });
  it("every supplied evidence reference points to an actual excerpt", () => {
    const ids = new Set(
      sampleCalls.flatMap((c) => c.excerpts.map((e) => e.id)),
    );
    for (const theme of sampleThemes)
      for (const id of theme.evidence) expect(ids.has(id)).toBe(true);
  });
});
