"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { workspace } from "@/lib/supabase/server";
export async function saveWeeklyDigest(f: FormData) {
  const { db, org } = await workspace();
  const { error } = await db.rpc("set_weekly_digest", {
    org: org.id,
    active: f.get("enabled") === "on",
    destination: z.enum(["email", "slack"]).parse(f.get("channel")),
  });
  redirect("/workspace?digest=" + (error ? "failed" : "saved"));
}
