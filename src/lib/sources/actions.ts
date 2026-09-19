"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { workspace, serviceDatabase } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/security/tokens";
import { allowRequest } from "@/lib/security/rate-limit";
import { redact } from "@/lib/content-engine/domain";
import { fetchFathom, fetchSlackMessage, slackMessageRef } from "./providers";
export async function connectFathom(f: FormData) {
  const { db, org, user } = await workspace();
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || f.get("confirmed") !== "on")
    redirect("/workspace/ai?notice=source-failed");
  const { data: allowed } = await db.rpc("can_write", { org: org.id });
  if (!allowed) redirect("/workspace/ai?notice=source-failed");
  const token = z.string().min(10).max(500).parse(f.get("token"));
  const { error } = await serviceDatabase().rpc("store_source_credential", {
    org: org.id,
    person: user.id,
    channel: "fathom",
    encrypted: encryptToken(token, key, `${org.id}:${user.id}:fathom:source`),
    expiry: null,
  });
  redirect(
    "/workspace/ai?notice=" + (error ? "source-failed" : "source-key-saved"),
  );
}
export async function importSource(f: FormData) {
  const { db, org, user } = await workspace();
  let notice = "source-failed";
  try {
    const provider = z.enum(["fathom", "slack"]).parse(f.get("provider"));
    const ref = z.string().max(1000).parse(f.get("reference"));
    if (f.get("permission") !== "on") throw new Error("Permission required");
    const { data: allowed } = await db.rpc("can_write", { org: org.id });
    if (!allowed || !(await allowRequest("source-import", user.id, 1, 60)))
      throw new Error("Wait before importing again");
    const service = serviceDatabase();
    const { data: connection } = await service
      .from("source_credentials")
      .select("token_encrypted,expires_at")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single();
    if (
      !connection ||
      !process.env.TOKEN_ENCRYPTION_KEY ||
      (connection.expires_at && Date.parse(connection.expires_at) <= Date.now())
    )
      throw new Error("Reconnect");
    const token = decryptToken(
      connection.token_encrypted,
      process.env.TOKEN_ENCRYPTION_KEY,
      `${org.id}:${user.id}:${provider}:source`,
    );
    const body =
      provider === "fathom"
        ? await fetchFathom(token, ref)
        : await fetchSlackMessage(token, ref);
    const external =
      provider === "fathom"
        ? ref
        : Object.values(slackMessageRef(ref)).join(":");
    const { error } = await service.rpc("stage_source_import", {
      org: org.id,
      person: user.id,
      channel: provider,
      external,
      body,
      expected: connection.token_encrypted,
    });
    if (error) throw new Error("Review unavailable");
    notice = "source-imported";
  } catch {
    /* No source text, tokens or provider payloads are logged. */
  }
  revalidatePath("/workspace/ai");
  redirect("/workspace/ai?notice=" + notice);
}
export async function approveImport(f: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("approve_source_import", {
    item: z.uuid().parse(f.get("id")),
    edited: redact(z.string().min(30).max(16000).parse(f.get("content"))),
    usage: z.enum(["inspiration_only", "approved_fact"]).parse(f.get("usage")),
    approved: f.get("approved") === "on",
  });
  revalidatePath("/workspace/ai");
  redirect(
    "/workspace/ai?notice=" + (error ? "source-failed" : "source-approved"),
  );
}
export async function disconnectSource(f: FormData) {
  const { db, org } = await workspace();
  await db.rpc("disconnect_source", {
    org: org.id,
    channel: z.enum(["fathom", "slack"]).parse(f.get("provider")),
  });
  revalidatePath("/workspace/ai");
  redirect("/workspace/ai?notice=source-disconnected");
}
