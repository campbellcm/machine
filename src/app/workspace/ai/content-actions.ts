"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { workspace } from "@/lib/supabase/server";
import { redact } from "@/lib/content-engine/domain";
export async function adaptContent(f: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("adapt_content", {
    draft: z.uuid().parse(f.get("id")),
    platform: z.enum(["linkedin", "x"]).parse(f.get("platform")),
  });
  revalidatePath("/workspace/ai");
  redirect(
    "/workspace/ai?view=drafts&notice=" +
      (error ? "adapt-failed" : "adapt-queued"),
  );
}
export async function createBrief(f: FormData) {
  const { db, org } = await workspace();
  const fields = z
    .object({
      title: z.string().trim().min(3).max(120),
      objective: z.string().trim().min(3).max(400),
      audience: z.string().trim().min(3).max(400),
      facts: z.string().trim().min(30).max(12000),
      cta: z.string().trim().min(3).max(400),
      approved: z.literal("on"),
    })
    .safeParse(Object.fromEntries(f));
  if (!fields.success) redirect("/workspace/ai?notice=brief-failed");
  const p = fields.data;
  const { error } = await db.rpc("create_campaign_brief", {
    org: org.id,
    title: redact(p.title),
    objective: redact(p.objective),
    audience: redact(p.audience),
    facts: redact(p.facts),
    cta: redact(p.cta),
    approved: true,
  });
  revalidatePath("/workspace/ai");
  redirect("/workspace/ai?notice=" + (error ? "brief-failed" : "brief-saved"));
}
