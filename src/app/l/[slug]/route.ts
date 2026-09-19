import { allowRequest } from "@/lib/security/rate-limit";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceDatabase } from "@/lib/supabase/server";
import { destinationUrl, isBot, visitorHash } from "@/lib/tracking/core";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{7}$/.test(slug))
    return new NextResponse("Link not found", { status: 404 });
  try {
    const db = serviceDatabase();
    const { data: link } = await db
      .from("tracked_links")
      .select("id,campaign_id,organization_id,draft_id")
      .eq("slug", slug)
      .single();
    if (!link) return new NextResponse("Link not found", { status: 404 });
    const { data: campaign } = await db
      .from("campaigns")
      .select("destination_url,utm_campaign")
      .eq("id", link.campaign_id)
      .eq("organization_id", link.organization_id)
      .eq("active", true)
      .single();
    if (!campaign) return new NextResponse("Link not found", { status: 404 });
    const { data: draft } = await db
      .from("drafts")
      .select("channel")
      .eq("id", link.draft_id)
      .eq("organization_id", link.organization_id)
      .single();
    if (!draft || !["linkedin", "x"].includes(draft.channel))
      return new NextResponse("Link not found", { status: 404 });
    const channel = draft.channel as "linkedin" | "x";
    let click: string | undefined;
    try {
      const candidate = randomUUID();
      const agent = (request.headers.get("user-agent") || "").slice(0, 500);
      const ip = (
        request.headers.get("x-vercel-forwarded-for") ||
        request.headers.get("x-forwarded-for") ||
        "unknown"
      )
        .split(",")[0]
        .trim();
      const hash = visitorHash(ip, agent, process.env.VISITOR_HASH_SALT || "");
      if (!(await allowRequest("redirect", hash, 120, 60)))
        return NextResponse.redirect(
          destinationUrl(
            campaign.destination_url,
            campaign.utm_campaign,
            slug,
            undefined,
            channel,
          ),
          { status: 302, headers: { "Cache-Control": "no-store" } },
        );
      const { error } = await db.rpc("log_click", {
        link: link.id,
        click: candidate,
        visitor: hash,
        bot: isBot(agent),
      });
      if (!error) click = candidate;
    } catch {
      /* Redirect even when analytics is unavailable. No raw IP is stored. */
    }
    return NextResponse.redirect(
      destinationUrl(
        campaign.destination_url,
        campaign.utm_campaign,
        slug,
        click,
        channel,
      ),
      {
        status: 302,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch {
    return new NextResponse("Link unavailable", { status: 503 });
  }
}
