import "server-only";
import { z } from "zod";
import { appUrl } from "@/lib/supabase/config";
// Official X OAuth 2.0 PKCE and create-post docs verified 2026-09-17.
export function xConfig() {
  const clientId = process.env.X_CLIENT_ID,
    clientSecret = process.env.X_CLIENT_SECRET,
    encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  return clientId && clientSecret && encryptionKey
    ? {
        clientId,
        clientSecret,
        encryptionKey,
        redirectUri: appUrl() + "/api/social/x/callback",
      }
    : null;
}
export async function exchangeX(code: string, verifier: string) {
  const config = xConfig();
  if (!config) throw new Error("Setup required");
  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(config.clientId + ":" + config.clientSecret).toString(
          "base64",
        ),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Connection failed");
  const token = z
    .object({
      access_token: z.string().min(1),
      expires_in: z.number().positive(),
    })
    .parse(await response.json());
  const profileResponse = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: "Bearer " + token.access_token },
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!profileResponse.ok) throw new Error("Profile unavailable");
  const { data: profile } = z
    .object({
      data: z.object({
        id: z.string().regex(/^\d+$/),
        name: z.string().max(200),
        username: z.string().regex(/^[A-Za-z0-9_]+$/),
      }),
    })
    .parse(await profileResponse.json());
  return { token, profile };
}
export async function sendX(token: string, body: string) {
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: body }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false as const };
  const parsed = z
    .object({ data: z.object({ id: z.string().regex(/^\d+$/) }) })
    .safeParse(await response.json());
  return parsed.success
    ? { ok: true as const, id: parsed.data.data.id }
    : { ok: false as const };
}
