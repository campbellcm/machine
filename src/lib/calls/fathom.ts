import { z } from "zod";

// Response contract checked 2026-09-17 against:
// https://developers.fathom.ai/api-reference/recordings/get-transcript
// Parsing only: no live connector, network calls, credentials, or import route.
const responseSchema = z
  .object({
    transcript: z
      .array(
        z.object({
          speaker: z.object({ display_name: z.string().min(1).max(300) }),
          text: z.string().max(20000),
          timestamp: z.string().regex(/^\d{2,3}:[0-5]\d:[0-5]\d$/),
        }),
      )
      .min(1)
      .max(10000),
  })
  .refine(
    (data) =>
      data.transcript.reduce((sum, s) => sum + s.text.length, 0) <= 500000,
  );

export function normalizeFathomTranscript(payload: unknown) {
  const parsed = responseSchema.safeParse(payload);
  // Do not include source values or Zod error payloads in errors/logs.
  if (!parsed.success)
    throw new Error("Unsupported or oversized transcript response.");
  const speakers = new Map<string, string>();
  return parsed.data.transcript.map((segment, index) => {
    const name = segment.speaker.display_name;
    if (!speakers.has(name)) speakers.set(name, `speaker-${speakers.size + 1}`);
    const [hours, minutes, seconds] = segment.timestamp.split(":").map(Number);
    return {
      id: `segment-${index + 1}`,
      speakerId: speakers.get(name)!,
      startSeconds: hours * 3600 + minutes * 60 + seconds,
      text: segment.text,
    };
  });
}
