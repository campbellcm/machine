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
      metric: z.enum([
        "leads",
        "unique_clicks",
        "published_posts",
        "active_days",
        "improvement_posts",
        "first_post",
        "team_posts",
      ]),
      target: z.coerce.number().int().min(1).max(100000).optional(),
      start: z.iso.datetime({ offset: true }),
      end: z.iso.datetime({ offset: true }),
    })
    .safeParse(Object.fromEntries(f));
  if (!parsed.success) redirect("/workspace/rewards?notice=invalid");
  const p = parsed.data;
  const { error } = await db.rpc("create_reward_v2", {
    org: org.id,
    title: p.title,
    prize_text: p.prize,
    rules_text:
      {
        active_days:
          "Most distinct publishing days in the company timezone. Multiple posts per day count once.",
        improvement_posts:
          "Largest absolute increase in posts versus the immediately preceding equal-duration period, with a minimum score of zero.",
        first_post:
          "First recorded participating publication during the challenge. Earlier untracked history cannot be verified.",
        team_posts:
          "When the shared target is reached, all eligible contributors with at least one post win. Company delivers the described prize to each qualifying contributor.",
        leads: "Most attributed leads and demo requests.",
        unique_clicks: "Most unique tracked clicks.",
        published_posts: "Most verified workspace publications.",
      }[p.metric] +
      "\n" +
      p.rules +
      "\nAll opted-in eligible members participate. Ties: earliest final scoring event, then stable member ID. Results settle for 72 hours. Company fulfills the prize.",
    metric_name: p.metric,
    goal: p.target || null,
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
