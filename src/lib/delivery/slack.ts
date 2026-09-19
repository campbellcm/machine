import "server-only";
import { z } from "zod";
import { appUrl } from "@/lib/supabase/config";
export function slackConfig() {
  const clientId = process.env.SLACK_CLIENT_ID,
    clientSecret = process.env.SLACK_CLIENT_SECRET,
    encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  return clientId && clientSecret && encryptionKey
    ? {
        clientId,
        clientSecret,
        encryptionKey,
        redirectUri: appUrl() + "/api/delivery/slack/callback",
      }
    : null;
}
export async function exchangeSlack(code: string) {
  const c = slackConfig();
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
  });
  if (!r.ok) throw new Error("Slack authorization failed");
  const result = z
    .object({
      ok: z.literal(true),
      access_token: z.string().min(1),
      scope: z.string(),
      team: z.object({ id: z.string().regex(/^T[A-Z0-9]+$/) }),
      authed_user: z.object({ id: z.string().regex(/^[UW][A-Z0-9]+$/) }),
      expires_in: z.number().positive().optional(),
    })
    .parse(await r.json());
  if (!result.scope.split(",").includes("chat:write"))
    throw new Error("Message permission required");
  return result;
}
export async function sendSlackNotice(
  token: string,
  user: string,
  text: string,
) {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: user,
      text,
      unfurl_links: false,
      unfurl_media: false,
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!r.ok) return false;
  return z.object({ ok: z.boolean() }).parse(await r.json()).ok;
}
