"use server";
import { allowRequest } from "@/lib/security/rate-limit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { workspace, serviceDatabase } from "@/lib/supabase/server";
import { linkedinConfig, sendLinkedIn } from "./linkedin";
import { xConfig, sendX } from "./x";
import { decryptToken } from "@/lib/security/tokens";
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
  const { data: account } = await service
    .from("social_accounts")
    .select("*")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .eq("provider", channel)
    .single();
  if (!account || new Date(account.expires_at).getTime() <= Date.now())
    redirect("/workspace/drafts?notice=not-configured");
  if (!(await allowRequest("publish", user.id, 30, 3600)))
    redirect("/workspace/drafts?notice=not-saved");
  const { data: claimed, error } = await db.rpc("claim_channel_publish", {
    target_channel: channel,
    draft: id,
    expected_revision: revision,
  });
  if (error || !claimed) redirect("/workspace/drafts?notice=not-saved");
  let outcome = "uncertain";
  try {
    const token = decryptToken(
      account.token_encrypted,
      config.encryptionKey,
      `${org.id}:${user.id}:${channel}`,
    );
    const result =
      channel === "x"
        ? await sendX(token, claimed)
        : await sendLinkedIn(token, account.provider_user_id, claimed);
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
    // Even failures stay locked if delivery cannot be established. No blind retry.
  } catch {
    /* Provider timeout may mean delivery succeeded. Keep claim locked. */
  }
  if (outcome !== "published")
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
