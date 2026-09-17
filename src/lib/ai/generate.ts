import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { draftsPrompt } from "./prompts/drafts-v1";
export const generatedDraftsSchema = z.object({
  drafts: z
    .array(
      z.object({
        body: z.string().min(1).max(3000),
        claims_to_verify: z.array(z.string().max(500)).max(12),
      }),
    )
    .length(3),
});
export type WritingSource = {
  company: string;
  context: string;
  voice: string;
  blocked: string[];
  role: string;
  topics: string[];
  focus: string;
  answers: { question: string; answer: string }[];
};
// Direct Anthropic API per PRD, official TypeScript SDK docs verified 2026-09-17.
export async function generateDrafts(source: WritingSource) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey || !model) throw new Error("AI setup required");
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 25000 });
  const schema = z.toJSONSchema(generatedDraftsSchema);
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4500,
      system: draftsPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            ...source,
            disclosure: `I work at ${source.company}.`,
          }),
        },
      ],
      tools: [
        {
          name: "draft_posts",
          description: "Return three grounded drafts.",
          input_schema: { ...schema, type: "object" },
        },
      ],
      tool_choice: { type: "tool", name: "draft_posts" },
    });
    const block = response.content.find(
      (b) => b.type === "tool_use" && b.name === "draft_posts",
    );
    const parsed = generatedDraftsSchema.safeParse(
      block?.type === "tool_use" ? block.input : null,
    );
    if (parsed.success) {
      const drafts = parsed.data.drafts.map((d) => ({
        ...d,
        body: d.body.startsWith(`I work at ${source.company}.`)
          ? d.body
          : `I work at ${source.company}.\n\n${d.body}`,
      }));
      if (
        drafts.every(
          (d) =>
            d.body.length <= 3000 &&
            !source.blocked.some(
              (p) => p.trim() && d.body.toLowerCase().includes(p.toLowerCase()),
            ),
        )
      )
        return drafts;
    }
  }
  throw new Error("Generated drafts did not pass validation");
}
