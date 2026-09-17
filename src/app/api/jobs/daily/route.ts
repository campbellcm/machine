import { secureEqual } from "@/lib/security/tokens";
import { runDueDailySchedules } from "@/lib/ai/daily";
export const maxDuration = 30;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await runDueDailySchedules();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Job failed" }, { status: 500 });
  }
}
