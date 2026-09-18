import "server-only";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
import { decryptToken, encryptToken } from "@/lib/security/tokens";
import { refreshX, xConfig } from "./x";
import { linkedinConfig } from "./linkedin";
export type Channel = "linkedin" | "x";
export class ConnectionError extends Error {
  constructor(public readonly reason: "reconnect" | "busy" | "setup") {
    super(reason);
  }
}
const claimSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ready"),
    encrypted: z.string(),
    provider_person: z.string(),
  }),
  z.object({
    kind: z.literal("refresh"),
    encrypted: z.string(),
    provider_person: z.string(),
    lease: z.uuid(),
  }),
  z.object({ kind: z.literal("reconnect") }),
  z.object({ kind: z.literal("busy") }),
]);
export async function connectionToken(
  org: string,
  person: string,
  channel: Channel,
) {
  const config = channel === "x" ? xConfig() : linkedinConfig();
  if (!config) throw new ConnectionError("setup");
  const db = serviceDatabase();
  const args = { org, person, channel_name: channel };
  const { data, error } = await db.rpc("claim_connection_token", args);
  if (error) throw new ConnectionError("setup");
  const claim = claimSchema.parse(data);
  if (claim.kind === "busy" || claim.kind === "reconnect")
    throw new ConnectionError(claim.kind);
  const context = `${org}:${person}:${channel}`;
  if (claim.kind === "ready")
    return {
      token: decryptToken(claim.encrypted, config.encryptionKey, context),
      encrypted: claim.encrypted,
      providerPerson: claim.provider_person,
    };
  try {
    const refreshed = await refreshX(
      decryptToken(claim.encrypted, config.encryptionKey, context + ":refresh"),
    );
    const encrypted = encryptToken(
      refreshed.access_token,
      config.encryptionKey,
      context,
    );
    const { data: saved, error: saveError } = await db.rpc(
      "finish_connection_refresh",
      {
        ...args,
        lease: claim.lease,
        encrypted,
        refresh_encrypted: encryptToken(
          refreshed.refresh_token,
          config.encryptionKey,
          context + ":refresh",
        ),
        expiry: new Date(
          Date.now() + refreshed.expires_in * 1000,
        ).toISOString(),
      },
    );
    if (saveError || !saved) throw new Error("Connection changed");
    return {
      token: refreshed.access_token,
      encrypted,
      providerPerson: claim.provider_person,
    };
  } catch {
    // Never replay an ambiguous refresh: rotation may already have consumed it.
    await db.rpc("finish_connection_refresh", {
      ...args,
      lease: claim.lease,
      encrypted: null,
      refresh_encrypted: null,
      expiry: null,
    });
    throw new ConnectionError("reconnect");
  }
}
export function providerIssue(status: number) {
  return status === 401
    ? "reconnect"
    : status === 403
      ? "permissions"
      : status === 429
        ? "rate_limit"
        : "unavailable";
}
export async function recordConnectionCheck(
  org: string,
  person: string,
  channel: Channel,
  encrypted: string,
  issue: string | null,
) {
  const { error } = await serviceDatabase().rpc("record_connection_check", {
    org,
    person,
    channel_name: channel,
    expected_token: encrypted,
    issue,
  });
  if (error) throw new Error("Could not record connection health");
}
export async function verifyConnection(
  org: string,
  person: string,
  channel: Channel,
) {
  const account = await connectionToken(org, person, channel);
  let issue: string | null = "unavailable";
  try {
    const response = await fetch(
      channel === "x"
        ? "https://api.x.com/2/users/me"
        : "https://api.linkedin.com/v2/userinfo",
      {
        headers: { Authorization: "Bearer " + account.token },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      },
    );
    if (response.ok) {
      const body = await response.json();
      const id =
        channel === "x"
          ? z.object({ data: z.object({ id: z.string() }) }).parse(body).data.id
          : z.object({ sub: z.string() }).parse(body).sub;
      issue = id === account.providerPerson ? null : "reconnect";
    } else issue = providerIssue(response.status);
  } catch {
    /* Safe status only, never provider response text. */
  }
  await recordConnectionCheck(org, person, channel, account.encrypted, issue);
  return issue;
}
export async function renewConnections() {
  if (!xConfig()) return;
  const { data, error } = await serviceDatabase()
    .from("social_accounts")
    .select("organization_id,user_id")
    .eq("provider", "x")
    .not("refresh_token_encrypted", "is", null)
    .is("connection_issue", null)
    .lte("expires_at", new Date(Date.now() + 20 * 60000).toISOString())
    .order("expires_at")
    .limit(1);
  if (error) throw new Error("Connection maintenance unavailable");
  for (const account of data || []) {
    try {
      await connectionToken(account.organization_id, account.user_id, "x");
    } catch {
      /* Each account has its own reconnect state; never log credentials. */
    }
  }
}
