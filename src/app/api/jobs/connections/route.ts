import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/security/tokens";
import { renewConnections } from "@/lib/social/connection";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await renewConnections();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Connection maintenance unavailable" },
      { status: 503 },
    );
  }
}
