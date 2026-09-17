import { z } from "zod";
import { workspace } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/security/rate-limit";
import {
  profileSchema,
  strategySchema,
  sourceInput,
  redact,
  normalizeMetrics,
  editDistance,
} from "@/lib/content-engine/domain";
import { engineReady, processEngineJob } from "@/lib/content-engine/service";
import { revalidatePath } from "next/cache";
export async function POST(request: Request) {
  const { db, org, user } = await workspace();
  if (new URL(request.url).origin !== request.headers.get("origin"))
    return Response.json({ error: "Request origin invalid" }, { status: 403 });
  if (!(await allowRequest("content-engine", user.id, 40, 60)))
    return Response.json(
      { error: "Please wait a moment before trying again." },
      { status: 429 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 40000) throw new Error("Request too large");
    const { operation, input } = z
      .object({
        operation: z.enum([
          "strategy",
          "profile",
          "pause",
          "resume",
          "reset_preferences",
          "delete_profile",
          "source",
          "delete_source",
          "ideas",
          "generate",
          "chat",
          "dismiss",
          "retry",
          "edit",
          "approve",
          "review",
          "request_changes",
          "reject",
          "archive",
          "more",
          "less",
          "export",
          "published",
          "metrics",
        ]),
        input: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    let data = input;
    if (operation === "strategy")
      data = { config: strategySchema.parse(input.config) };
    else if (operation === "profile")
      data = {
        config: profileSchema.parse(input.config),
        consent: z.boolean().parse(input.consent),
        step: z.number().int().min(0).max(6).parse(input.step),
      };
    else if (operation === "source") {
      const p = sourceInput.parse(input);
      data = { ...p, text: redact(p.text), title: redact(p.title) };
    } else if (operation === "metrics")
      data = {
        ...input,
        metrics: normalizeMetrics(
          z.record(z.string(), z.unknown()).parse(input.metrics),
        ),
      };
    else if (operation === "generate" || operation === "chat")
      data = {
        id: z.uuid().parse(input.id),
        instruction: redact(
          z
            .string()
            .trim()
            .max(500)
            .min(operation === "chat" ? 1 : 0)
            .parse(input.instruction || ""),
        ),
        key: z.uuid().parse(input.key),
      };
    else if (operation === "edit") {
      const id = z.uuid().parse(input.id);
      const { data: previous } = await db
        .from("drafts")
        .select("body")
        .eq("id", id)
        .eq("organization_id", org.id)
        .eq("user_id", user.id)
        .single();
      if (!previous) throw new Error("Draft unavailable");
      const body = z.string().min(1).max(3000).parse(input.body);
      data = {
        ...input,
        id,
        body,
        edit_distance: editDistance(previous.body, body),
      };
    }
    if (operation === "chat" && !engineReady())
      return Response.json(
        {
          error:
            "Your company needs to connect OpenAI before drafting can begin.",
        },
        { status: 503 },
      );
    const { data: result, error } = await db.rpc("ce_command", {
      org: org.id,
      operation: operation === "chat" ? "generate" : operation,
      input: data,
    });
    if (error)
      return Response.json(
        {
          error: error.message.includes("limit")
            ? "Your generation limit has been reached. Try again after the limit resets."
            : error.message.includes("Draft changed")
              ? "This draft changed. Refresh before continuing."
              : "Could not complete this action. Check permissions, approval, setup and required fields.",
        },
        { status: 400 },
      );
    // The authorized, rate-limited queue creates the job. Claiming rechecks consent
    // and source access before an immediate attempt; the scheduler handles retries.
    if (operation === "chat" && result?.id) {
      try {
        await processEngineJob(result.id);
      } catch {
        // Keep the durable job available to the existing queue. Never log content.
      }
    }
    revalidatePath("/workspace/ai");
    return Response.json(result);
  } catch {
    return Response.json(
      { error: "Check the required fields and try again." },
      { status: 400 },
    );
  }
}
