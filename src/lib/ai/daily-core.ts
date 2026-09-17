import { z } from "zod";
export const dailyInput = z.object({
  provider: z.enum(["openai", "anthropic"]),
  channel: z.enum(["linkedin", "x"]),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone"),
  hour: z.coerce.number().int().min(0).max(23),
  context: z.string().trim().min(20).max(6000),
  consent: z.literal("on"),
});
export const dailyOutput = z.object({
  drafts: z
    .array(
      z.object({
        body: z.string().min(1).max(3000),
        claims_to_verify: z.array(z.string().max(500)).max(12),
      }),
    )
    .length(3),
});
export function validateDailyOutput(
  raw: unknown,
  company: string,
  channel: "linkedin" | "x",
  blocked: string[],
) {
  const drafts = dailyOutput.parse(raw).drafts;
  const limit = channel === "x" ? 280 : 3000;
  for (const draft of drafts) {
    if (
      !draft.body.startsWith(`I work at ${company}.`) ||
      [...draft.body].length > limit ||
      blocked.some(
        (p) => p.trim() && draft.body.toLowerCase().includes(p.toLowerCase()),
      )
    )
      throw new Error("Draft failed guardrails");
  }
  if (new Set(drafts.map((d) => d.body.trim().toLowerCase())).size !== 3)
    throw new Error("Distinct drafts required");
  return drafts;
}
