import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workspace } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { encryptToken } from "@/lib/security/tokens";
import { sourceSlackConfig } from "@/lib/sources/slack";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== appUrl())
    return new NextResponse("Invalid origin", { status: 403 });
  const { user, member, org } = await workspace();
  const c = sourceSlackConfig();
  if (
    !c ||
    !member.opted_in_at ||
    !["owner", "admin", "teammate"].includes(member.role)
  )
    return NextResponse.redirect(appUrl() + "/workspace/ai?notice=setup", 303);
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set(
    "crewcast_slack_source",
    encryptToken(
      JSON.stringify({
        state,
        user: user.id,
        org: org.id,
        expires: Date.now() + 600000,
      }),
      c.encryptionKey,
      "slack-source-oauth",
    ),
    {
      httpOnly: true,
      secure: appUrl().startsWith("https:"),
      sameSite: "lax",
      path: "/api/sources/slack",
      maxAge: 600,
    },
  );
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.search = new URLSearchParams({
    client_id: c.clientId,
    user_scope: "channels:history,channels:read",
    redirect_uri: c.redirectUri,
    state,
  }).toString();
  return NextResponse.redirect(url, 303);
}
