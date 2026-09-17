import { z } from "zod";

export const sensitiveDetailSchema = z.object({
  value: z.string().trim().min(1).max(300),
  kind: z.enum(["company", "person", "commercial", "roadmap", "contact"]),
  replacement: z.string().min(1).max(100),
});
export type SensitiveDetail = z.infer<typeof sensitiveDetailSchema>;

// A bounded, deterministic demonstration; NOT a production anonymization engine.
// Unknown entities and contextual identifiers require semantic detection + human review.
export function redactKnownDetails(text: string, details: SensitiveDetail[]) {
  let result = text;
  const findings: { kind: SensitiveDetail["kind"]; count: number }[] = [];
  for (const detail of [...details].sort(
    (a, b) => b.value.length - a.value.length,
  )) {
    const escaped = detail.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(escaped, "giu");
    const count = [...result.matchAll(pattern)].length;
    if (count) {
      result = result.replace(pattern, () => detail.replacement);
      findings.push({ kind: detail.kind, count });
    }
  }
  return { text: result, findings };
}

export function checkSampleDraft(body: string, details: SensitiveDetail[]) {
  const issues: string[] = [];
  if (!body.trim()) issues.push("Add draft text.");
  if (body.length > 3000)
    issues.push("Keep this LinkedIn draft within 3,000 characters.");
  const normalized = body.normalize("NFKC").toLocaleLowerCase();
  if (
    details.some((d) =>
      normalized.includes(d.value.normalize("NFKC").toLocaleLowerCase()),
    )
  )
    issues.push(
      "A known identifying detail from the sample calls is still present.",
    );
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|https?:\/\/\S+/i.test(body))
    issues.push("Remove contact details and URLs from this sample draft.");
  if (/[$£€]\s*\d|\b\d+(?:\.\d+)?\s*%/.test(body))
    issues.push(
      "Review and remove financial amounts or precise percentages from this sample.",
    );
  if (!/^I work at Acme\.(?:\s|$)/.test(body.trimStart()))
    issues.push("Keep the sample employment disclosure: “I work at Acme.”");
  return issues;
}

export function canCopySampleDraft(
  body: string,
  approvedBody: string | null,
  details: SensitiveDetail[],
) {
  return (
    approvedBody !== null &&
    body === approvedBody &&
    checkSampleDraft(body, details).length === 0
  );
}
