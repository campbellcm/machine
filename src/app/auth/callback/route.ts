import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appUrl() + "/workspace");
  }
  return NextResponse.redirect(appUrl() + "/login?message=expired-link");
}
