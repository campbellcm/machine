"use server";
import { workspace } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
export async function disconnectSlack() {
  const { db, org } = await workspace();
  const { error } = await db.rpc("disconnect_slack_delivery", { org: org.id });
  revalidatePath("/workspace/ai");
  redirect(
    "/workspace/ai?notice=" +
      (error ? "delivery-failed" : "slack-disconnected"),
  );
}
