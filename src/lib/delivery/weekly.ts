import "server-only";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
import { appUrl } from "@/lib/supabase/config";
import { productName } from "@/lib/config";
import { emailDeliveryReady, sendPrivateNotice } from "./worker";
const digestSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  user_id: z.uuid(),
  channel: z.enum(["email", "slack"]),
  lease: z.uuid(),
  summary: z.object({
    from: z.string(),
    until: z.string(),
    posts: z.number().nonnegative(),
    participants: z.number().nonnegative(),
    clicks: z.number().nonnegative(),
    leads: z.number().nonnegative(),
    top_post: z
      .object({ url: z.string().nullable(), clicks: z.number().nonnegative() })
      .nullable(),
  }),
});
export async function deliverWeeklyDigest() {
  const channels = [
    ...(emailDeliveryReady() ? ["email"] : []),
    ...(process.env.TOKEN_ENCRYPTION_KEY ? ["slack"] : []),
  ];
  if (!channels.length) return;
  const db = serviceDatabase();
  const { data, error } = await db.rpc("claim_weekly_digest", { channels });
  if (error) throw new Error("Digest unavailable");
  if (!data) return;
  const claim = digestSchema.parse(data),
    s = claim.summary;
  const next =
    s.posts === 0
      ? "Help willing teammates connect an account and review their first draft."
      : s.clicks === 0
        ? "Try a relevant tracked call to action on your next post."
        : s.leads === 0
          ? "Check your conversion setup and whether the linked page matches the post."
          : "Review the strongest post and test a fresh angle using approved evidence.";
  const top =
    s.top_post?.url &&
    /^https:\/\/(www\.)?(x\.com|linkedin\.com)\//.test(s.top_post.url)
      ? `Top tracked post: ${s.top_post.clicks} unique clicks this week. ${s.top_post.url}\n`
      : "";
  const text = `Your ${productName} week: ${s.from.slice(0, 10)} to ${s.until.slice(0, 10)} (UTC, end exclusive).\n${s.participants} participants shared ${s.posts} posts. ${s.clicks} unique tracked clicks and ${s.leads} attributed leads/demo requests.\n${top}Next step: ${next}\nViews and sales are unavailable; attributed outcomes do not establish causation. Participation is optional.\nOpen your team: ${appUrl()}/draft-inbox?org=${claim.organization_id}&view=home\nChange or stop your weekly digest in Home.`;
  const outcome = await sendPrivateNotice(
    db,
    claim,
    text,
    `Your ${productName} weekly team digest`,
    "weekly-digest",
  );
  await db.rpc("finish_weekly_digest", {
    delivery: claim.id,
    claim: claim.lease,
    outcome,
  });
}
