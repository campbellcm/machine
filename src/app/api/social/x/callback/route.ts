import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { signedIn, serviceDatabase } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { exchangeX, xConfig } from "@/lib/social/x";
import { decryptToken, encryptToken, secureEqual } from "@/lib/security/tokens";
export async function GET(request: NextRequest) {
  const { user, db } = await signedIn();
  const jar = await cookies();
  const envelope = jar.get("crewcast_x_oauth")?.value;
  jar.set("crewcast_x_oauth", "", { path: "/api/social/x", maxAge: 0 });
  const config = xConfig();
  let outcome = "failed";
  try {
    if (!config || !envelope) throw new Error("Invalid connection");
    const state = z
      .object({
        state: z.string(),
        verifier: z.string(),
        user: z.uuid(),
        org: z.uuid(),
        expires: z.number(),
      })
      .parse(
        JSON.parse(decryptToken(envelope, config.encryptionKey, "x-oauth")),
      );
    if (
      state.user !== user.id ||
      state.expires < Date.now() ||
      !secureEqual(state.state, request.nextUrl.searchParams.get("state") || "")
    )
      throw new Error("Invalid state");
    const code = z
      .string()
      .min(1)
      .max(4096)
      .parse(request.nextUrl.searchParams.get("code"));
    const { data: eligible } = await db.rpc("can_write", { org: state.org });
    if (!eligible) throw new Error("Not eligible");
    const { profile, token } = await exchangeX(code, state.verifier);
    const { error } = await serviceDatabase().rpc("store_x_account", {
      org: state.org,
      person: user.id,
      provider_person: profile.id,
      person_name: "@" + profile.username,
      encrypted: encryptToken(
        token.access_token,
        config.encryptionKey,
        `${state.org}:${user.id}:x`,
      ),
      expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });
    if (error) throw new Error("Save failed");
    outcome = "connected";
  } catch {
    /* Never log codes, credentials, or provider payloads. */
  }
  return NextResponse.redirect(appUrl() + "/workspace/team?notice=" + outcome);
}
