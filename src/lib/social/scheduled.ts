import "server-only";
import { serviceDatabase } from "@/lib/supabase/server";
import { linkedinConfig, sendLinkedIn } from "./linkedin";
import {
  connectionToken,
  recordConnectionCheck,
  providerIssue,
} from "./connection";
import { z } from "zod";
const claimSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  organization_id: z.uuid(),
  user_id: z.uuid(),
});
export async function runScheduledPosts() {
  const config = linkedinConfig();
  if (!config) return;
  const db = serviceDatabase();
  const { data: jobs } = await db
    .from("publish_jobs")
    .select("id")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at")
    .limit(1);
  for (const job of jobs || []) {
    const { data: raw } = await db.rpc("claim_scheduled_post", { job: job.id });
    if (!raw) continue;
    const parsed = claimSchema.safeParse(raw);
    if (!parsed.success) continue;
    const draft = parsed.data;
    let success = false;
    try {
      const account = await connectionToken(
        draft.organization_id,
        draft.user_id,
        "linkedin",
      );
      const sent = await sendLinkedIn(
        account.token,
        account.providerPerson,
        draft.body,
      );
      if (!sent.ok)
        await recordConnectionCheck(
          draft.organization_id,
          draft.user_id,
          "linkedin",
          account.encrypted,
          providerIssue(sent.status),
        );
      if (sent.ok) {
        const { error } = await db.rpc("complete_publish", {
          draft: draft.id,
          post_id: sent.id,
        });
        success = !error;
      }
    } catch {
      /* Do not retry ambiguous delivery. */
    }
    if (!success)
      await db
        .from("drafts")
        .update({ status: "publish_uncertain" })
        .eq("id", draft.id)
        .eq("status", "publishing");
    await db
      .from("publish_jobs")
      .update({ status: success ? "done" : "failed" })
      .eq("id", job.id);
  }
}
