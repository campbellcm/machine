import "server-only";
import { z } from "zod";
import { serviceDatabase } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/security/tokens";
import { appUrl } from "@/lib/supabase/config";
import { productName } from "@/lib/config";
import { sendSlackNotice } from "./slack";
export function emailDeliveryReady() {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}
const claimSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  user_id: z.uuid(),
  channel: z.enum(["email", "slack"]),
  lease: z.uuid(),
});
export async function deliverDraftNotice(id: string) {
  const db = serviceDatabase();
  const { data, error } = await db.rpc("claim_draft_delivery", {
    delivery: id,
  });
  if (error) throw new Error("Delivery queue unavailable");
  if (!data) return;
  const claim = claimSchema.parse(data);
  let outcome: "sent" | "failed" | "uncertain" = "failed";
  const text = `Your daily ${productName} drafts are ready. Review and edit them privately: ${appUrl()}/draft-inbox?org=${claim.organization_id}\nNothing is published without your approval. Pause daily drafts in AI to stop these messages.`;
  try {
    if (claim.channel === "email" && emailDeliveryReady()) {
      const { data: auth } = await db.auth.admin.getUserById(claim.user_id);
      const email = z.email().parse(auth.user?.email);
      if (!auth.user?.email_confirmed_at) throw new Error("Verify email first");
      outcome = "uncertain";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + process.env.RESEND_API_KEY,
          "Content-Type": "application/json",
          "Idempotency-Key": "draft-delivery/" + claim.id,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [email],
          subject: `Your daily ${productName} drafts`,
          text,
        }),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      outcome =
        r.ok &&
        z.object({ id: z.string().min(1) }).safeParse(await r.json()).success
          ? "sent"
          : "failed";
    } else if (claim.channel === "slack") {
      const { data: account } = await db
        .from("slack_delivery_accounts")
        .select("*")
        .eq("organization_id", claim.organization_id)
        .eq("user_id", claim.user_id)
        .maybeSingle();
      if (
        !account ||
        (account.expires_at && Date.parse(account.expires_at) <= Date.now()) ||
        !process.env.TOKEN_ENCRYPTION_KEY
      )
        throw new Error("Reconnect Slack");
      const token = decryptToken(
        account.token_encrypted,
        process.env.TOKEN_ENCRYPTION_KEY,
        `${claim.organization_id}:${claim.user_id}:slack:delivery`,
      );
      outcome = "uncertain";
      outcome = (await sendSlackNotice(token, account.slack_user_id, text))
        ? "sent"
        : "failed";
    }
  } catch {
    /* An uncertain send is never blindly repeated. No recipient/content logs. */
  }
  await db.rpc("finish_draft_delivery", {
    delivery: id,
    claim: claim.lease,
    outcome,
  });
}
export async function deliverDraftQueue() {
  const channels = [
    ...(emailDeliveryReady() ? ["email"] : []),
    ...(process.env.TOKEN_ENCRYPTION_KEY ? ["slack"] : []),
  ];
  if (!channels.length) return;
  const db = serviceDatabase();
  const { data, error } = await db
    .from("draft_deliveries")
    .select("id")
    .in("status", ["pending", "sending"])
    .in("channel", channels)
    .order("created_at")
    .limit(1);
  if (error) throw new Error("Delivery setup required");
  for (const row of data || []) await deliverDraftNotice(row.id);
}
