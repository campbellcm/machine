import "server-only";
import { serviceDatabase } from "@/lib/supabase/server";
import { sendLinkedIn } from "./linkedin";
import { sendX } from "./x";
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
  channel: z.enum(["linkedin", "x"]),
  revision: z.number().int(),
});
export async function runScheduledPosts() {
  const db = serviceDatabase();
  const { data: jobs } = await db
    .from("publish_jobs")
    .select("id,draft_id,organization_id,user_id,revision,run_at")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at")
    .limit(1);
  for (const job of jobs || []) {
    const { data: row } = await db
      .from("drafts")
      .select("channel")
      .eq("id", job.draft_id)
      .single();
    const channel = z.enum(["linkedin", "x"]).safeParse(row?.channel);
    if (!channel.success) continue;
    let account;
    try {
      if (channel.data === "x") {
        const { data: health } = await db
          .from("social_accounts")
          .select("expires_at,refresh_claim")
          .eq("organization_id", job.organization_id)
          .eq("user_id", job.user_id)
          .eq("provider", "x")
          .maybeSingle();
        if (
          !health ||
          health.refresh_claim ||
          Date.parse(health.expires_at) <= Date.now() + 21 * 60000
        )
          throw new Error("Renew connection first");
      }
      account = await connectionToken(
        job.organization_id,
        job.user_id,
        channel.data,
      );
    } catch {
      await db
        .from("publish_jobs")
        .update({ status: "failed" })
        .eq("id", job.id)
        .eq("status", "pending")
        .eq("revision", job.revision)
        .eq("run_at", job.run_at);
      continue;
    }
    const { data: raw, error: claimError } = await db.rpc(
      "claim_scheduled_post",
      { job: job.id },
    );
    if (claimError) {
      await db
        .from("publish_jobs")
        .update({ status: "failed" })
        .eq("id", job.id)
        .eq("status", "pending")
        .eq("revision", job.revision)
        .eq("run_at", job.run_at);
      continue;
    }
    const parsed = claimSchema.safeParse(raw);
    if (!parsed.success) continue;
    const draft = parsed.data;
    let success = false,
      rejected = false;
    try {
      const sent =
        draft.channel === "x"
          ? await sendX(account.token, draft.body)
          : await sendLinkedIn(
              account.token,
              account.providerPerson,
              draft.body,
            );
      if (sent.ok) {
        const { error } = await db.rpc(
          draft.channel === "x" ? "complete_x_publish" : "complete_publish",
          { draft: draft.id, post_id: sent.id },
        );
        success = !error;
      } else {
        await recordConnectionCheck(
          draft.organization_id,
          draft.user_id,
          draft.channel,
          account.encrypted,
          providerIssue(sent.status),
        );
        if ([400, 401, 403, 422, 429].includes(sent.status)) {
          const { data: released } = await db.rpc("reject_publish_attempt", {
            draft: draft.id,
            expected_revision: draft.revision,
          });
          rejected = !!released;
        }
      }
    } catch {
      /* Never blindly replay uncertain delivery. */
    }
    if (!success && !rejected)
      await db
        .from("drafts")
        .update({ status: "publish_uncertain" })
        .eq("id", draft.id)
        .eq("status", "publishing");
    // A released job may already have been rescheduled by its author.
    if (!rejected)
      await db
        .from("publish_jobs")
        .update({ status: success ? "done" : "failed" })
        .eq("id", job.id)
        .eq("status", "running")
        .eq("revision", job.revision)
        .eq("run_at", job.run_at);
  }
}
