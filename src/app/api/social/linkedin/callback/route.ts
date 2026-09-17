import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { signedIn, serviceDatabase } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { exchangeLinkedIn, linkedinConfig } from "@/lib/social/linkedin";
import { decryptToken, encryptToken, secureEqual } from "@/lib/security/tokens";
export async function GET(request: NextRequest) {
  const { user, db } = await signedIn();
  const jar = await cookies();
  const envelope = jar.get("crewcast_oauth")?.value;
  jar.set("crewcast_oauth", "", { path: "/api/social/linkedin", maxAge: 0 });
  const config = linkedinConfig();
  let outcome = "failed";
  try {
    if (!config || !envelope) throw new Error("Invalid connection");
    const state = z
      .object({
        state: z.string(),
        user: z.uuid(),
        org: z.uuid(),
        expires: z.number(),
      })
      .parse(
        JSON.parse(
          decryptToken(envelope, config.encryptionKey, "linkedin-oauth"),
        ),
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
    const { profile, token } = await exchangeLinkedIn(code);
    const service = serviceDatabase();
    const { error } = await service.rpc("store_social_account", {
      org: state.org,
      person: user.id,
      provider_person: profile.sub,
      person_name: profile.name,
      encrypted: encryptToken(
        token.access_token,
        config.encryptionKey,
        `${state.org}:${user.id}:linkedin`,
      ),
      expiry: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    });
    if (error) throw new Error("Could not save connection");
    outcome = "connected";
  } catch {
    /* Never log OAuth codes, tokens or provider responses. */
  }
  return NextResponse.redirect(
    appUrl() + "/workspace/connections?notice=" + outcome,
  );
}
