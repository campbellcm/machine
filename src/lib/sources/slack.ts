import "server-only";
import { z } from "zod";
import { slackConfig } from "@/lib/delivery/slack";
import { appUrl } from "@/lib/supabase/config";
export function sourceSlackConfig() {
  const c = slackConfig();
  return c
    ? { ...c, redirectUri: appUrl() + "/api/sources/slack/callback" }
    : null;
}
export async function exchangeSlackSource(code: string) {
  const c = sourceSlackConfig();
  if (!c) throw new Error("Setup required");
  const r = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      code,
      redirect_uri: c.redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
    redirect: "error",
  });
  if (!r.ok) throw new Error("Authorization failed");
  const result = z
    .object({
      ok: z.literal(true),
      authed_user: z.object({
        id: z.string().regex(/^[UW][A-Z0-9]+$/),
        access_token: z.string().min(1),
        scope: z.string(),
        expires_in: z.number().positive().optional(),
      }),
    })
    .parse(await r.json());
  if (
    !["channels:history", "channels:read"].every((scope) =>
      result.authed_user.scope.split(",").includes(scope),
    )
  )
    throw new Error("History permission required");
  return result.authed_user;
}
