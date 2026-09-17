import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { serviceDatabase } from "@/lib/supabase/server";
import {
  contentPrompt,
  extractionPrompt,
} from "@/lib/ai/prompts/content-engine-v1";
import {
  extractionSchema,
  draftOutput,
  profileSchema,
  strategySchema,
  scoreOpportunity,
  validateGeneration,
  redact,
  type Atom,
} from "./domain";
export const engineReady = () =>
  !!(
    process.env.OPENAI_API_KEY &&
    (process.env.OPENAI_CONTENT_MODEL || process.env.OPENAI_MODEL)
  );
export async function processEngineJob(id: string) {
  const db = serviceDatabase();
  const { data: context, error } = await db.rpc("ce_claim", { job: id });
  if (error) throw new Error("Queue unavailable");
  if (!context) return;
  const { job } = context;
  const started = Date.now();
  let usage: Record<string, unknown> = {};
  let failure = "generation_failed";
  try {
    const profile = profileSchema.parse(context.profile);
    const strategy = strategySchema.parse(context.strategy);
    let result: unknown;
    if (job.kind === "opportunities") {
      const atoms = context.evidence as Atom[];
      result = {
        opportunities: atoms
          .map((atom) => ({
            atom_id: atom.id,
            title: atom.summary,
            rationale: `Relevant to your work as ${profile.role} and your interest in ${profile.topics.slice(0, 2).join(" and ")}.`,
            scores: scoreOpportunity(
              atom,
              profile,
              context.recent,
              Number(context.preferences[atom.summary] || 0),
            ),
          }))
          .sort((a, b) => b.scores.overall - a.scores.overall)
          .slice(0, 8),
      };
    } else {
      if (!engineReady()) {
        failure = "provider_unavailable";
        throw new Error("Setup required");
      }
      const model =
        job.kind === "extract"
          ? process.env.OPENAI_EXTRACTION_MODEL ||
            process.env.OPENAI_CONTENT_MODEL ||
            process.env.OPENAI_MODEL!
          : process.env.OPENAI_CONTENT_MODEL || process.env.OPENAI_MODEL!;
      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: "https://api.openai.com/v1",
        maxRetries: 0,
        timeout: 18000,
      });
      usage = { model };
      if (job.kind === "extract") {
        const source = context.evidence;
        const response = await client.responses.parse({
          model,
          store: false,
          instructions: extractionPrompt,
          input: JSON.stringify({
            text: redact(source.content),
            allowed_roles: source.roles,
          }),
          max_output_tokens: 2400,
          text: { format: zodTextFormat(extractionSchema, "content_atoms") },
        });
        if (!response.output_parsed || response.status !== "completed") {
          failure = "invalid_output";
          throw new Error("Invalid extraction");
        }
        result = response.output_parsed;
        for (const atom of response.output_parsed.atoms)
          if (!source.content.includes(atom.excerpt)) {
            failure = "invalid_output";
            throw new Error("Unsupported evidence");
          }
        usage = {
          model,
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
        };
      } else {
        const atoms = context.evidence as Atom[];
        if (!atoms.length) {
          failure = "no_context";
          throw new Error("Context needed");
        }
        const response = await client.responses.parse({
          model,
          store: false,
          instructions: contentPrompt,
          input: JSON.stringify({
            company_strategy: {
              description: strategy.description,
              products: strategy.products,
              audiences: strategy.audiences,
              goals: strategy.goals,
              positioning: strategy.positioning,
              topics: strategy.topics,
              campaigns: strategy.campaigns,
              avoid: strategy.avoid,
              disclaimer: strategy.disclaimer,
            },
            role_strategy: strategy.roles,
            content_identity: profile,
            opportunity: {
              topic: context.opportunity.title,
              rationale: context.opportunity.rationale,
              instruction: job.payload.instruction || "",
            },
            authorized_evidence: atoms.map((a) => ({
              id: a.id,
              source_id: a.source_id,
              summary: a.summary,
              excerpt: a.excerpt,
              external_use: a.external_use,
            })),
            platform_constraints: {
              platform: profile.platform,
              limit: profile.platform === "x" ? 280 : 3000,
              disclosure: `I work at ${context.company}.`,
            },
            recent_topics: context.recent,
          }),
          max_output_tokens: 3800,
          text: { format: zodTextFormat(draftOutput, "content_variants") },
        });
        if (response.status !== "completed") {
          failure = "invalid_output";
          throw new Error("Incomplete output");
        }
        result = validateGeneration(
          response.output_parsed,
          atoms,
          context.company,
          profile.platform,
          strategy.avoid.split(/[,\n]/),
        );
        usage = {
          model,
          input_tokens: response.usage?.input_tokens,
          output_tokens: response.usage?.output_tokens,
        };
      }
    }
    usage = { ...usage, latency_ms: Date.now() - started };
    const { error: saveError } = await db.rpc("ce_finish", {
      job: id,
      claim: job.lease,
      result,
      usage,
    });
    if (saveError) throw new Error("Unable to save result");
  } catch {
    // Never log source text, model responses, prompts, or credentials.
    const { error: saveError } = await db.rpc("ce_finish", {
      job: id,
      claim: job.lease,
      result: {},
      usage: { ...usage, latency_ms: Date.now() - started },
      failure,
    });
    if (saveError) throw new Error("Unable to save job status");
  }
}
export async function processEngineQueue() {
  const db = serviceDatabase();
  const { error } = await db.rpc("ce_tick");
  if (error) throw new Error("Queue unavailable");
  const { data: jobs, error: readError } = await db
    .from("ce_jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .lte("available_at", new Date().toISOString())
    .lt("attempts", 3)
    .order("available_at")
    .limit(2);
  if (readError) throw new Error("Queue unavailable");
  await Promise.all((jobs || []).map((j) => processEngineJob(j.id)));
}
