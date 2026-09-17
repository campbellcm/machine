import { describe, it, expect } from "vitest";
import { recorders } from "./providers";
import {
  parseCallIntake,
  callImportIdentity,
  evidenceReadiness,
} from "./intake";
import {
  redactKnownDetails,
  checkSampleDraft,
  canCopySampleDraft,
} from "./privacy";
import { sampleSensitiveDetails, sampleThemes } from "./demo";

describe("shared workflow contract for eight providers (not live API tests)", () => {
  for (const provider of recorders)
    it(`${provider.name}: common intake flows through privacy review and version-specific draft review`, () => {
      const source = parseCallIntake({
        provider: provider.id,
        externalId: "fixture-1",
        sourceKind: "transcript",
        complete: true,
        segments: [
          {
            id: "s1",
            speakerId: null,
            startSeconds: null,
            text: "Northstar Labs needs clearer ownership.",
          },
        ],
        unusedContactEmail: "private@example.test",
      });
      expect(evidenceReadiness(source)).toBe("ready-for-privacy-review");
      expect(source).not.toHaveProperty("unusedContactEmail");
      const excerpt = redactKnownDetails(
        source.segments[0].text,
        sampleSensitiveDetails,
      );
      expect(excerpt.text).toBe("a customer company needs clearer ownership.");
      const draft = sampleThemes[0].draft;
      expect(checkSampleDraft(draft, sampleSensitiveDetails)).toEqual([]);
      expect(canCopySampleDraft(draft, null, sampleSensitiveDetails)).toBe(
        false,
      );
      expect(canCopySampleDraft(draft, draft, sampleSensitiveDetails)).toBe(
        true,
      );
      expect(
        canCopySampleDraft(draft + " Edited.", draft, sampleSensitiveDetails),
      ).toBe(false);
    });
  it("keeps unknown speakers and absent timestamps unknown rather than inventing evidence", () => {
    const call = parseCallIntake({
      provider: "otter",
      externalId: "x",
      sourceKind: "transcript",
      complete: true,
      segments: [
        {
          id: "a",
          speakerId: null,
          startSeconds: null,
          text: "An exported statement.",
        },
      ],
    });
    expect(call.segments[0].speakerId).toBeNull();
    expect(call.segments[0].startSeconds).toBeNull();
  });
  it("does not treat summaries or incomplete pagination as complete transcripts", () => {
    const base = parseCallIntake({
      provider: "granola",
      externalId: "x",
      sourceKind: "notes",
      complete: true,
      segments: [
        { id: "a", speakerId: null, startSeconds: null, text: "Summary only." },
      ],
    });
    expect(evidenceReadiness(base)).toBe("needs-transcript");
    expect(
      evidenceReadiness({ ...base, sourceKind: "transcript", complete: false }),
    ).toBe("awaiting-completion");
  });
  it("isolates import identity across providers, accounts and organizations", () => {
    const ids = new Set(
      recorders.map((p) =>
        callImportIdentity("org", "connection", {
          provider: p.id,
          externalId: "same",
        }),
      ),
    );
    expect(ids.size).toBe(8);
    const call = { provider: "fathom" as const, externalId: "same" };
    expect(callImportIdentity("org", "a", call)).not.toBe(
      callImportIdentity("org", "b", call),
    );
    expect(callImportIdentity("org-a", "a", call)).not.toBe(
      callImportIdentity("org-b", "a", call),
    );
  });
  it("rejects unknown providers, duplicate references, invalid timing and oversized text", () => {
    const valid = {
      provider: "fathom",
      externalId: "x",
      sourceKind: "transcript",
      complete: true,
      segments: [
        { id: "a", speakerId: null, startSeconds: 0, text: "Example." },
      ],
    };
    for (const bad of [
      { ...valid, provider: "unknown" },
      { ...valid, segments: [...valid.segments, ...valid.segments] },
      { ...valid, segments: [{ ...valid.segments[0], startSeconds: -1 }] },
      {
        ...valid,
        segments: [{ ...valid.segments[0], text: "x".repeat(20001) }],
      },
    ])
      expect(() => parseCallIntake(bad)).toThrow(
        "Unsupported or incomplete call source format.",
      );
  });
});
