import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { signedIn, serviceDatabase } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { encryptToken, decryptToken, secureEqual } from "@/lib/security/tokens";
import { slackConfig, exchangeSlack } from "@/lib/delivery/slack";
export async function GET(request: NextRequest) {
  const { user, db } = await signedIn();
  const jar = await cookies();
  const envelope = jar.get("crewcast_slack_delivery")?.value;
  jar.set("crewcast_slack_delivery", "", {
    path: "/api/delivery/slack",
    maxAge: 0,
  });
  const c = slackConfig();
  let notice = "delivery-failed";
  try {
    if (!c || !envelope) throw new Error("Invalid state");
    const state = z
      .object({
        state: z.string(),
        user: z.uuid(),
        org: z.uuid(),
        expires: z.number(),
      })
      .parse(
        JSON.parse(
          decryptToken(envelope, c.encryptionKey, "slack-delivery-oauth"),
        ),
      );
    if (
      state.user !== user.id ||
      state.expires < Date.now() ||
      !secureEqual(state.state, request.nextUrl.searchParams.get("state") || "")
    )
      throw new Error("Invalid state");
    const { data: eligible } = await db.rpc("can_write", { org: state.org });
    if (!eligible) throw new Error("Not eligible");
    const result = await exchangeSlack(
      z
        .string()
        .min(1)
        .max(4096)
        .parse(request.nextUrl.searchParams.get("code")),
    );
    const { error } = await serviceDatabase().rpc("store_slack_delivery", {
      org: state.org,
      person: user.id,
      team: result.team.id,
      slack_person: result.authed_user.id,
      encrypted: encryptToken(
        result.access_token,
        c.encryptionKey,
        `${state.org}:${user.id}:slack:delivery`,
      ),
      expiry: result.expires_in
        ? new Date(Date.now() + result.expires_in * 1000).toISOString()
        : null,
    });
    if (error) throw new Error("Connection unavailable");
    notice = "slack-connected";
  } catch {
    /* Do not log OAuth codes, provider payloads or secrets. */
  }
  return NextResponse.redirect(appUrl() + "/workspace/ai?notice=" + notice);
}
