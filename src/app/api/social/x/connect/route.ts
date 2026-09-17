import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { workspace } from "@/lib/supabase/server";
import { xConfig } from "@/lib/social/x";
import { encryptToken } from "@/lib/security/tokens";
import { appUrl } from "@/lib/supabase/config";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== appUrl())
    return new NextResponse("Invalid origin", { status: 403 });
  const { user, member, org } = await workspace();
  const config = xConfig();
  if (
    !config ||
    !member.opted_in_at ||
    !["owner", "admin", "teammate"].includes(member.role)
  )
    return NextResponse.redirect(
      appUrl() + "/workspace/team?notice=setup",
      303,
    );
  const state = randomBytes(32).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  const payload = encryptToken(
    JSON.stringify({
      state,
      verifier,
      user: user.id,
      org: org.id,
      expires: Date.now() + 600000,
    }),
    config.encryptionKey,
    "x-oauth",
  );
  (await cookies()).set("crewcast_x_oauth", payload, {
    httpOnly: true,
    secure: appUrl().startsWith("https:"),
    sameSite: "lax",
    path: "/api/social/x",
    maxAge: 600,
  });
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: "tweet.read tweet.write users.read",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return NextResponse.redirect(url, 303);
}
