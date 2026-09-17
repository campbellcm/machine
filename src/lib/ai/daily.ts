import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
import { dailyOutput, validateDailyOutput } from "./daily-core";
import { dailyPrompt } from "./prompts/daily-v1";
export function providerReady(provider: string) {
  return provider === "openai"
    ? !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL)
    : !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
}
const claimSchema = z.object({
  run_id: z.uuid(),
  lease: z.uuid(),
  organization_id: z.uuid(),
  user_id: z.uuid(),
  provider: z.enum(["openai", "anthropic"]),
  channel: z.enum(["linkedin", "x"]),
  context: z.string(),
  local_date: z.string(),
});
// Official OpenAI structured output and Anthropic Messages documentation checked 2026-09-17.
async function requestDrafts(
  provider: "openai" | "anthropic",
  source: Record<string, unknown>,
) {
  if (provider === "anthropic") {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 0,
      timeout: 18000,
    });
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL!,
      max_tokens: 3000,
      system: dailyPrompt,
      messages: [{ role: "user", content: JSON.stringify(source) }],
      tools: [
        {
          name: "daily_drafts",
          description: "Return three post options",
          input_schema: { ...z.toJSONSchema(dailyOutput), type: "object" },
        },
      ],
      tool_choice: { type: "tool", name: "daily_drafts" },
    });
    const block = response.content.find((b) => b.type === "tool_use");
    return block?.type === "tool_use" ? block.input : null;
  }
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      store: false,
      instructions: dailyPrompt,
      input: JSON.stringify(source),
      max_output_tokens: 3000,
      text: {
        format: {
          type: "json_schema",
          name: "daily_drafts",
          strict: true,
          schema: z.toJSONSchema(dailyOutput),
        },
      },
    }),
    signal: AbortSignal.timeout(18000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Provider unavailable");
  const payload = z
    .object({
      status: z.literal("completed"),
      output: z.array(
        z.object({
          type: z.string(),
          content: z
            .array(z.object({ type: z.string(), text: z.string().optional() }))
            .optional(),
        }),
      ),
    })
    .parse(await response.json());
  const text = payload.output
    .flatMap((o) => o.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text || "")
    .join("");
  return JSON.parse(text);
}
export async function runDailySchedule(id: string) {
  const db = serviceDatabase();
  const { data, error } = await db.rpc("claim_daily_run", { schedule: id });
  if (error) throw new Error("Unable to claim job");
  if (!data) return false;
  const job = claimSchema.parse(data);
  let failure: "provider_unavailable" | "generation_failed" =
    "generation_failed";
  try {
    if (!providerReady(job.provider)) {
      failure = "provider_unavailable";
      throw new Error("Setup required");
    }
    const [
      { data: org, error: orgError },
      { data: member, error: memberError },
      { data: recent, error: recentError },
    ] = await Promise.all([
      db
        .from("organizations")
        .select("name,context,voice,blocked_phrases")
        .eq("id", job.organization_id)
        .single(),
      db
        .from("memberships")
        .select("job_title,topics")
        .eq("organization_id", job.organization_id)
        .eq("user_id", job.user_id)
        .is("removed_at", null)
        .single(),
      db
        .from("drafts")
        .select("body")
        .eq("organization_id", job.organization_id)
        .eq("user_id", job.user_id)
        .not("daily_run_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);
    if (
      orgError ||
      memberError ||
      recentError ||
      !org ||
      !member ||
      !org.context.trim() ||
      !member.job_title.trim()
    )
      throw new Error("Context required");
    const raw = await requestDrafts(job.provider, {
      company: org.name,
      context: org.context.slice(0, 12000),
      voice: org.voice,
      role: member.job_title,
      topics: member.topics,
      approved_notes: job.context,
      recent_drafts: recent?.map((d) => d.body),
      date: job.local_date,
      channel: job.channel,
      character_limit: job.channel === "x" ? 280 : 3000,
      disclosure: `I work at ${org.name}.`,
    });
    const drafts = validateDailyOutput(
      raw,
      org.name,
      job.channel,
      org.blocked_phrases,
    );
    const { data: finished, error: finishError } = await db.rpc(
      "finish_daily_run",
      { run: job.run_id, claim: job.lease, items: drafts },
    );
    if (finishError) throw new Error("Unable to save drafts");
    return finished === true;
  } catch {
    const { error: finishError } = await db.rpc("finish_daily_run", {
      run: job.run_id,
      claim: job.lease,
      items: [],
      failure,
    });
    if (finishError) throw new Error("Unable to record job status");
    return false;
  }
}
export async function runDueDailySchedules() {
  const db = serviceDatabase();
  const { data, error } = await db
    .from("daily_schedules")
    .select("id")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at")
    .limit(2);
  if (error) throw new Error("Unable to read queue");
  await Promise.all((data || []).map((s) => runDailySchedule(s.id)));
}
