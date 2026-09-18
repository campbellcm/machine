"use server";
import { allowRequest } from "@/lib/security/rate-limit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { workspace, serviceDatabase } from "@/lib/supabase/server";
import { linkedinConfig, sendLinkedIn } from "./linkedin";
import { xConfig, sendX } from "./x";
import {
  ConnectionError,
  connectionToken,
  providerIssue,
  recordConnectionCheck,
  verifyConnection,
} from "./connection";
export async function disconnectLinkedIn() {
  const { db, org } = await workspace();
  const { error } = await db.rpc("disconnect_channel", {
    org: org.id,
    channel_name: "linkedin",
  });
  redirect(
    "/workspace/connections?notice=" + (error ? "failed" : "disconnected"),
  );
}
export async function publishLinkedIn(f: FormData) {
  const { db, user, org } = await workspace();
  const channel = z
    .enum(["linkedin", "x"])
    .parse(f.get("channel") || "linkedin");
  const config = channel === "x" ? xConfig() : linkedinConfig();
  if (!config || f.get("confirmed") !== "on")
    redirect("/workspace/drafts?notice=not-configured");
  const id = z.uuid().parse(f.get("id"));
  const revision = z.coerce.number().int().positive().parse(f.get("revision"));
  const service = serviceDatabase();
  let account;
  try {
    account = await connectionToken(org.id, user.id, channel);
  } catch (error) {
    redirect(
      "/workspace/drafts?notice=" +
        (error instanceof ConnectionError
          ? error.reason
          : "connection-unavailable"),
    );
  }
  if (!(await allowRequest("publish", user.id, 30, 3600)))
    redirect("/workspace/drafts?notice=not-saved");
  const { data: claimed, error } = await db.rpc("claim_channel_publish", {
    target_channel: channel,
    draft: id,
    expected_revision: revision,
  });
  if (error || !claimed) redirect("/workspace/drafts?notice=not-saved");
  let outcome = "uncertain";
  let rejected = false;
  try {
    const result =
      channel === "x"
        ? await sendX(account.token, claimed)
        : await sendLinkedIn(account.token, account.providerPerson, claimed);
    if (result.ok) {
      const { error: saveError } = await service.rpc(
        channel === "x" ? "complete_x_publish" : "complete_publish",
        {
          draft: id,
          post_id: result.id,
        },
      );
      if (!saveError) outcome = "published";
    }
    if (!result.ok && result.status) {
      const issue = providerIssue(result.status);
      await recordConnectionCheck(
        org.id,
        user.id,
        channel,
        account.encrypted,
        issue,
      );
      outcome = issue;
      if ([400, 401, 403, 422, 429].includes(result.status)) {
        const { data: released } = await service.rpc("reject_publish_attempt", {
          draft: id,
          expected_revision: revision,
        });
        if (released) {
          rejected = true;
          outcome = "rejected-" + issue;
        }
      }
    }
    // Even failures stay locked if delivery cannot be established. No blind retry.
  } catch {
    /* Provider timeout may mean delivery succeeded. Keep claim locked. */
  }
  if (outcome !== "published" && !rejected)
    await service
      .from("drafts")
      .update({ status: "publish_uncertain" })
      .eq("id", id)
      .eq("status", "publishing");
  revalidatePath("/workspace", "layout");
  redirect("/workspace/drafts?notice=" + outcome);
}

export async function scheduleLinkedIn(f: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("schedule_post", {
    draft: z.uuid().parse(f.get("id")),
    expected_revision: z.coerce.number().int().parse(f.get("revision")),
    publish_at: z.iso.datetime({ offset: true }).parse(f.get("publish_at")),
  });
  revalidatePath("/workspace/drafts");
  redirect("/workspace/drafts?notice=" + (error ? "not-saved" : "saved"));
}
export async function cancelScheduled(f: FormData) {
  const { db } = await workspace();
  await db.rpc("cancel_scheduled_post", { draft: z.uuid().parse(f.get("id")) });
  revalidatePath("/workspace/drafts");
  redirect("/workspace/drafts");
}

export async function disconnectChannel(f: FormData) {
  const { db, org } = await workspace();
  const channel = z.enum(["linkedin", "x"]).parse(f.get("channel"));
  const { error } = await db.rpc("disconnect_channel", {
    org: org.id,
    channel_name: channel,
  });
  revalidatePath("/workspace/team");
  redirect("/workspace/team?notice=" + (error ? "failed" : "disconnected"));
}

export async function checkConnection(f: FormData) {
  const { user, org } = await workspace();
  const channel = z.enum(["linkedin", "x"]).parse(f.get("channel"));
  if (!(await allowRequest("connection-check", user.id, 6, 60)))
    redirect("/workspace/team?notice=rate_limit");
  let notice = "checked";
  try {
    notice = (await verifyConnection(org.id, user.id, channel)) || "checked";
  } catch (error) {
    notice = error instanceof ConnectionError ? error.reason : "unavailable";
  }
  revalidatePath("/workspace/team");
  redirect("/workspace/team?notice=" + notice);
}
