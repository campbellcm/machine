import { runScheduledPosts } from "@/lib/social/scheduled";
import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/security/tokens";
import { serviceDatabase } from "@/lib/supabase/server";
export const maxDuration=300;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secureEqual(request.headers.get("authorization") || "", "Bearer " + secret)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const db = serviceDatabase();
    await db.from('drafts').update({status:'publish_uncertain'}).eq('status','publishing').lt('updated_at',new Date(Date.now()-15*60000).toISOString());
    await db.from('rate_buckets').delete().lt('window_start',new Date(Date.now()-7*86400000).toISOString());
    await runScheduledPosts();
    const { error } = await db.rpc("advance_challenges");
    if (error) throw new Error("Job failed");
    await db
      .from("interviews")
      .delete()
      .lt("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Job failed" }, { status: 500 });
  }
}
