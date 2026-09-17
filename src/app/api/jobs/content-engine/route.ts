import { secureEqual } from "@/lib/security/tokens";
import { processEngineQueue } from "@/lib/content-engine/service";
export const maxDuration = 30;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await processEngineQueue();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Processing unavailable" }, { status: 503 });
  }
}
