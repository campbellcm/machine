"use server";
import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { workspace } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
export async function createCampaign(f: FormData) {
  const { db, org } = await workspace();
  const url = new URL(z.url().parse(f.get("destination")));
  if (url.protocol !== "https:" || url.username || url.password)
    redirect("/workspace/campaigns?notice=invalid");
  const { error } = await db.rpc("create_campaign", {
    org: org.id,
    campaign_name: z.string().min(1).max(100).parse(f.get("name")),
    destination: url.toString(),
    campaign_utm: z.string().min(1).max(100).parse(f.get("utm")),
  });
  revalidatePath("/workspace/campaigns");
  redirect("/workspace/campaigns?notice=" + (error ? "failed" : "saved"));
}
export async function attachLink(f: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("attach_link", {
    draft: z.uuid().parse(f.get("id")),
    campaign: z.uuid().parse(f.get("campaign")),
    new_slug: randomBytes(6).toString("base64url").slice(0, 7),
    base_url: appUrl(),
    expected_revision: Number(f.get("revision")),
  });
  revalidatePath("/workspace/drafts");
  revalidatePath("/workspace/ai");
  redirect(
    f.get("return_to") === "ai"
      ? "/workspace/ai?view=drafts&notice=" +
          (error ? "link-failed" : "link-added")
      : "/workspace/drafts?notice=" + (error ? "failed" : "saved"),
  );
}
export async function createKey() {
  const { db, org } = await workspace();
  const key = "cc_" + randomBytes(32).toString("base64url");
  const { error } = await db.rpc("create_conversion_key", {
    org: org.id,
    hashed: createHash("sha256").update(key).digest("hex"),
    key_prefix: key.slice(0, 10),
  });
  if (error) redirect("/workspace/campaigns?notice=failed");
  (await cookies()).set("crewcast_new_key", key, {
    httpOnly: true,
    sameSite: "strict",
    secure: appUrl().startsWith("https:"),
    path: "/workspace/campaigns",
    maxAge: 120,
  });
  redirect("/workspace/campaigns?notice=key-created");
}
export async function revokeKeys() {
  const { db, org } = await workspace();
  await db.rpc("revoke_conversion_keys", { org: org.id });
  (await cookies()).set("crewcast_new_key", "", {
    path: "/workspace/campaigns",
    maxAge: 0,
  });
  redirect("/workspace/campaigns");
}
