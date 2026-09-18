import "server-only";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
import { connectionToken, providerIssue } from "@/lib/social/connection";
const count = z.number().int().nonnegative().optional();
export const xTimeline = z.object({
  data: z
    .array(
      z.object({
        id: z.string().regex(/^\d+$/),
        author_id: z.string().regex(/^\d+$/),
        text: z.string().max(30000),
        created_at: z.iso.datetime(),
        public_metrics: z
          .object({
            impression_count: count,
            like_count: count,
            reply_count: count,
            retweet_count: count,
          })
          .optional(),
      }),
    )
    .max(100)
    .default([]),
  errors: z.array(z.unknown()).optional(),
  meta: z.object({
    result_count: z.number().int().nonnegative(),
    next_token: z.string().optional(),
  }),
});
export async function syncOwnPosts(
  org: string,
  person: string,
  scheduled = false,
) {
  const db = serviceDatabase();
  const { data: setting } = await db
    .from("social_syncs")
    .select("enabled")
    .eq("organization_id", org)
    .eq("user_id", person)
    .eq("provider", "x")
    .maybeSingle();
  if (!setting?.enabled) return;
  if (scheduled) {
    // Leave renewal to its separate worker; never add its 15s deadline to a sync.
    const { data: account } = await db
      .from("social_accounts")
      .select("expires_at,refresh_claim")
      .eq("organization_id", org)
      .eq("user_id", person)
      .eq("provider", "x")
      .maybeSingle();
    if (
      !account ||
      account.refresh_claim ||
      Date.parse(account.expires_at) <= Date.now() + 21 * 60000
    ) {
      await db
        .from("social_syncs")
        .update({
          last_attempt_at: new Date().toISOString(),
          issue: account ? "renewal_pending" : "reconnect",
        })
        .eq("organization_id", org)
        .eq("user_id", person)
        .eq("provider", "x");
      return;
    }
  }
  let issue = "unavailable";
  try {
    const account = await connectionToken(org, person, "x");
    const url = new URL(
      `https://api.x.com/2/users/${account.providerPerson}/tweets`,
    );
    url.search = new URLSearchParams({
      "tweet.fields": "created_at,author_id,public_metrics",
      max_results: "100",
      exclude: "retweets,replies",
      start_time: new Date(Date.now() - 29 * 86400000).toISOString(),
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + account.token },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const batch = xTimeline.parse(await response.json());
      if (
        batch.errors?.length ||
        batch.meta.result_count !== batch.data.length ||
        batch.data.some((p) => p.author_id !== account.providerPerson)
      )
        throw new Error("Incomplete response");
      const { data: saved, error } = await db.rpc("save_tracked_posts", {
        org,
        person,
        channel_name: "x",
        provider_person_id: account.providerPerson,
        items: batch.data,
      });
      if (error || !saved) throw new Error("Sync stopped");
      if (batch.meta?.next_token)
        await db
          .from("social_syncs")
          .update({ issue: "recent_100_only" })
          .eq("organization_id", org)
          .eq("user_id", person)
          .eq("provider", "x");
      return;
    }
    issue = providerIssue(response.status);
  } catch {
    /* No post contents, tokens, or provider payloads in logs. */
  }
  await db
    .from("social_syncs")
    .update({ last_attempt_at: new Date().toISOString(), issue })
    .eq("organization_id", org)
    .eq("user_id", person)
    .eq("provider", "x");
}
export async function syncDuePosts() {
  const db = serviceDatabase();
  const { data, error } = await db
    .from("social_syncs")
    .select("organization_id,user_id")
    .eq("enabled", true)
    .eq("provider", "x")
    .or(
      `last_attempt_at.is.null,last_attempt_at.lt.${new Date(Date.now() - 3600000).toISOString()}`,
    )
    .order("last_attempt_at", { nullsFirst: true })
    .limit(1);
  if (error) throw new Error("Tracking setup required");
  for (const item of data || [])
    await syncOwnPosts(item.organization_id, item.user_id, true);
}
