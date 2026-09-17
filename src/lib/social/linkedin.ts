import "server-only";
import { z } from "zod";
import { appUrl } from "@/lib/supabase/config";
// Official LinkedIn OAuth, OIDC and Share on LinkedIn docs checked 2026-09-17.
export function linkedinConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  return clientId && clientSecret && encryptionKey
    ? {
        clientId,
        clientSecret,
        encryptionKey,
        redirectUri: appUrl() + "/api/social/linkedin/callback",
      }
    : null;
}
export async function exchangeLinkedIn(code: string) {
  const config = linkedinConfig();
  if (!config) throw new Error("Setup required");
  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Connection could not be completed");
  const token = z
    .object({
      access_token: z.string().min(1),
      expires_in: z.number().positive(),
    })
    .parse(await response.json());
  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!profileResponse.ok) throw new Error("Profile unavailable");
  const profile = z
    .object({
      sub: z.string().regex(/^[A-Za-z0-9_-]+$/),
      name: z.string().max(200),
    })
    .parse(await profileResponse.json());
  return { token, profile };
}
export async function sendLinkedIn(
  token: string,
  person: string,
  body: string,
) {
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${person}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: body },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false as const, status: response.status };
  const id = response.headers.get("x-restli-id");
  if (!id || !/^urn:li:(share|ugcPost):\d+$/.test(id))
    return { ok: false as const, status: 502 };
  return { ok: true as const, id };
}
