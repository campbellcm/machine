"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
export async function createChallenge(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("create_challenge", {
    org: org.id,
    title: z.string().min(1).max(100).parse(f.get("name")),
    rules_text: z.string().max(10000).parse(f.get("rules")),
    metric_name: z
      .enum(["leads", "unique_clicks", "published_posts"])
      .parse(f.get("metric")),
    start_time: z.iso.datetime({ offset: true }).parse(f.get("start")),
    end_time: z.iso.datetime({ offset: true }).parse(f.get("end")),
    winners: z.coerce.number().int().min(1).max(10).parse(f.get("winners")),
  });
  redirect("/workspace/challenges?notice=" + (error ? "failed" : "saved"));
}
