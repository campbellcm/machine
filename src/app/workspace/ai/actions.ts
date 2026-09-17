"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { workspace } from "@/lib/supabase/server";
import { dailyInput } from "@/lib/ai/daily-core";
import { providerReady, runDailySchedule } from "@/lib/ai/daily";
import { allowRequest } from "@/lib/security/rate-limit";
export async function saveDaily(f: FormData) {
  const { db, org, member } = await workspace();
  const parsed = dailyInput.safeParse(Object.fromEntries(f));
  if (!parsed.success) redirect("/workspace/ai?notice=invalid");
  const p = parsed.data;
  if (!providerReady(p.provider)) redirect("/workspace/ai?notice=setup");
  if (!org.context.trim() || !member.job_title.trim())
    redirect("/workspace/ai?notice=context");
  const { error } = await db.rpc("save_daily_schedule", {
    org: org.id,
    ai_provider: p.provider,
    target_channel: p.channel,
    tz: p.timezone,
    hour: p.hour,
    approved_context: p.context,
    active: true,
  });
  revalidatePath("/workspace/ai");
  redirect("/workspace/ai?notice=" + (error ? "failed" : "saved"));
}
export async function controlDaily(f: FormData) {
  const { db, org, user } = await workspace();
  const operation = f.get("operation");
  if (operation !== "pause" && operation !== "run")
    redirect("/workspace/ai?notice=invalid");
  if (
    operation === "run" &&
    !(await allowRequest("daily-run", user.id, 3, 3600))
  )
    redirect("/workspace/ai?notice=limit");
  const { data: s } = await db
    .from("daily_schedules")
    .select("id,provider")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .single();
  if (!s) redirect("/workspace/ai?notice=failed");
  if (operation === "run" && !providerReady(s.provider))
    redirect("/workspace/ai?notice=setup");
  const { error } = await db.rpc("control_daily_schedule", {
    org: org.id,
    operation,
  });
  if (error) redirect("/workspace/ai?notice=failed");
  if (operation === "run") await runDailySchedule(s.id);
  revalidatePath("/workspace/ai");
  redirect(
    "/workspace/ai?notice=" + (operation === "pause" ? "paused" : "checked"),
  );
}
