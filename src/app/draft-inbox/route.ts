import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { database } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const org = z.uuid().safeParse(request.nextUrl.searchParams.get("org"));
  if (!org.success) return NextResponse.redirect(appUrl() + "/workspace/ai");
  const db = await database();
  const {
    data: { user },
  } = await db.auth.getUser();
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  if (!user) {
    jar.set("crewcast_inbox_org", org.data, { ...options, maxAge: 3600 });
    return NextResponse.redirect(appUrl() + "/login");
  }
  jar.set("crewcast_inbox_org", "", { ...options, maxAge: 0 });
  const { data: membership } = await db
    .from("memberships")
    .select("organization_id")
    .eq("organization_id", org.data)
    .eq("user_id", user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (!membership) return NextResponse.redirect(appUrl() + "/workspace");
  jar.set("crewcast_org", org.data, { ...options, maxAge: 86400 * 30 });
  return NextResponse.redirect(appUrl() + "/workspace/ai?view=drafts");
}
