"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { workspace } from "@/lib/supabase/server";
export async function createReward(f: FormData) {
  const { db, org } = await workspace();
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(100),
      prize: z.string().trim().min(1).max(500),
      rules: z.string().max(9000),
      metric: z.enum(["leads", "unique_clicks", "published_posts"]),
      start: z.iso.datetime({ offset: true }),
      end: z.iso.datetime({ offset: true }),
    })
    .safeParse(Object.fromEntries(f));
  if (!parsed.success) redirect("/workspace/rewards?notice=invalid");
  const p = parsed.data;
  const { error } = await db.rpc("create_reward", {
    org: org.id,
    title: p.title,
    prize_text: p.prize,
    rules_text:
      p.rules +
      "\nAll opted-in eligible members participate. Ties: earliest final scoring event, then stable member ID. Results settle for 72 hours. Company fulfills the prize.",
    metric_name: p.metric,
    start_time: p.start,
    end_time: p.end,
  });
  revalidatePath("/workspace/rewards");
  redirect("/workspace/rewards?notice=" + (error ? "failed" : "saved"));
}
export async function fulfillReward(f: FormData) {
  const { db } = await workspace();
  const id = z.uuid().parse(f.get("id"));
  if (f.get("confirmed") !== "on")
    redirect("/workspace/rewards?notice=invalid");
  const { error } = await db.rpc("fulfill_reward", { reward: id });
  revalidatePath("/workspace/rewards");
  redirect("/workspace/rewards?notice=" + (error ? "failed" : "fulfilled"));
}
