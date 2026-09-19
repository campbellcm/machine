import { cookies } from "next/headers";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const db = await database();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const org = z
        .uuid()
        .safeParse((await cookies()).get("crewcast_inbox_org")?.value);
      const view =
        (await cookies()).get("crewcast_inbox_view")?.value === "home"
          ? "home"
          : "drafts";
      return NextResponse.redirect(
        appUrl() +
          (org.success
            ? "/draft-inbox?org=" + org.data + "&view=" + view
            : "/workspace"),
      );
    }
  }
  return NextResponse.redirect(appUrl() + "/login?message=expired-link");
}
