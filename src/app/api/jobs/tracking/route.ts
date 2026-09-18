import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/security/tokens";
import { syncDuePosts } from "@/lib/analytics/sync";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await syncDuePosts();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Post tracking unavailable" },
      { status: 503 },
    );
  }
}
