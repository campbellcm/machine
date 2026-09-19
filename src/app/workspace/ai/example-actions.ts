"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
export async function saveExample(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("save_post_example", {
    org: org.id,
    post: z.uuid().parse(f.get("id")),
    reason: z
      .string()
      .max(400)
      .parse(f.get("note") || ""),
    remove: f.get("remove") === "yes",
  });
  revalidatePath("/workspace/ai");
  redirect(
    "/workspace/ai?notice=" + (error ? "example-failed" : "example-saved"),
  );
}
