"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { workspace } from "@/lib/supabase/server";
import { allowRequest } from "@/lib/security/rate-limit";
import { syncOwnPosts } from "./sync";
export async function setTracking(form: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("set_post_tracking", {
    org: org.id,
    channel_name: "x",
    enabled_value: form.get("enabled") === "true",
  });
  revalidatePath("/workspace");
  redirect("/workspace?tracking=" + (error ? "failed" : "saved"));
}
export async function selectWorkPost(form: FormData) {
  const { db } = await workspace();
  const { error } = await db.rpc("select_work_post", {
    post: z.uuid().parse(form.get("id")),
    include_post: form.get("include") === "true",
  });
  revalidatePath("/workspace");
  redirect("/workspace?tracking=" + (error ? "failed" : "saved"));
}
export async function syncPosts() {
  const { org, user } = await workspace();
  if (await allowRequest("post-sync", user.id, 3, 3600))
    await syncOwnPosts(org.id, user.id);
  revalidatePath("/workspace");
  redirect("/workspace?tracking=checked");
}
