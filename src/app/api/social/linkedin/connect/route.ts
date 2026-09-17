import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workspace } from "@/lib/supabase/server";
import { linkedinConfig } from "@/lib/social/linkedin";
import { encryptToken } from "@/lib/security/tokens";
import { appUrl } from "@/lib/supabase/config";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== appUrl())
    return new NextResponse("Invalid origin", { status: 403 });
  const { user, member, org } = await workspace();
  const config = linkedinConfig();
  if (
    !config ||
    !member.opted_in_at ||
    !["owner", "admin", "teammate"].includes(member.role)
  )
    return NextResponse.redirect(
      appUrl() + "/workspace/connections?notice=setup",
      303,
    );
  const state = randomBytes(32).toString("base64url");
  const payload = encryptToken(
    JSON.stringify({
      state,
      user: user.id,
      org: org.id,
      expires: Date.now() + 600000,
    }),
    config.encryptionKey,
    "linkedin-oauth",
  );
  (await cookies()).set("crewcast_oauth", payload, {
    httpOnly: true,
    secure: appUrl().startsWith("https:"),
    sameSite: "lax",
    path: "/api/social/linkedin",
    maxAge: 600,
  });
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: "openid profile w_member_social",
  }).toString();
  return NextResponse.redirect(url, 303);
}
