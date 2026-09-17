import { z } from "zod";
import { recorderProviderSchema } from "./providers";

// Internal adapter contract, NOT any provider's native response schema.
// A future authenticated server adapter must establish tenant/owner/eligibility
// independently before calling this. Parsing is not authorization or anonymization.
export const callIntakeSchema = z
  .object({
    provider: recorderProviderSchema,
    externalId: z.string().min(1).max(300),
    sourceKind: z.enum(["transcript", "notes"]),
    complete: z.boolean(),
    segments: z
      .array(
        z.object({
          id: z.string().min(1).max(100),
          speakerId: z.string().max(100).nullable(),
          startSeconds: z.number().finite().nonnegative().nullable(),
          text: z.string().trim().min(1).max(20000),
        }),
      )
      .min(1)
      .max(10000),
  })
  .superRefine((call, ctx) => {
    if (new Set(call.segments.map((s) => s.id)).size !== call.segments.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate segment references.",
      });
    if (call.segments.reduce((n, s) => n + s.text.length, 0) > 500000)
      ctx.addIssue({ code: "custom", message: "Source exceeds text limit." });
  });
export type CallIntake = z.infer<typeof callIntakeSchema>;
export function parseCallIntake(input: unknown): CallIntake {
  const result = callIntakeSchema.safeParse(input);
  if (!result.success)
    throw new Error("Unsupported or incomplete call source format.");
  return result.data;
}
// Provider and connection scope prevent matching another account's identical ID.
// Use a database unique constraint on these columns in the eventual importer.
export function callImportIdentity(
  organizationId: string,
  connectionId: string,
  call: Pick<CallIntake, "provider" | "externalId">,
) {
  return JSON.stringify([
    organizationId,
    connectionId,
    call.provider,
    call.externalId,
  ]);
}
export function evidenceReadiness(
  call: CallIntake,
): "needs-transcript" | "awaiting-completion" | "ready-for-privacy-review" {
  if (call.sourceKind === "notes") return "needs-transcript";
  if (!call.complete) return "awaiting-completion";
  return "ready-for-privacy-review";
}
