import { connectionNotice } from "@/lib/social/health";
import { workspace } from "@/lib/supabase/server";
import { engineReady } from "@/lib/content-engine/service";
import {
  defaultStrategy,
  profileSchema,
  strategySchema,
} from "@/lib/content-engine/domain";
import { ContentEngine } from "@/components/content-engine/content-engine";
import type { EngineData, EngineDraft } from "@/lib/content-engine/types";
export default async function AI({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  const { db, org, user, member } = await workspace();
  const admin = ["owner", "admin"].includes(member.role);
  const [
    settings,
    profile,
    sources,
    ideas,
    meta,
    jobs,
    versions,
    metrics,
    connections,
    report,
  ] = await Promise.all([
    db
      .from("ce_settings")
      .select("*")
      .eq("organization_id", org.id)
      .maybeSingle(),
    db
      .from("ce_profiles")
      .select("*")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("ce_sources")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("ce_opportunities")
      .select("*")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("ce_draft_meta")
      .select("*")
      .eq("organization_id", org.id)
      .order("created_at", { ascending: false })
      .limit(60),
    db
      .from("ce_jobs")
      .select("id,kind,status,attempts,error_code,created_at")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("ce_versions")
      .select("draft_id,revision,body")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("revision", { ascending: false })
      .limit(120),
    db
      .from("ce_metrics")
      .select("draft_id,metrics,observed_at")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("observed_at", { ascending: false })
      .limit(100),
    db.rpc("team_connections", { org: org.id }),
    admin
      ? db.rpc("ce_admin_report", { org: org.id })
      : Promise.resolve({ data: null, error: null }),
  ]);
  const ids = (meta.data || []).map((m) => m.draft_id);
  const { data: drafts } = ids.length
    ? await db
        .from("drafts")
        .select(
          "id,user_id,body,channel,revision,published_at,linkedin_url,status,publish_method",
        )
        .eq("organization_id", org.id)
        .in("id", ids)
    : { data: [] };
  const { data: publicationJobs } = await db
    .from("publish_jobs")
    .select("draft_id,run_at,status")
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .in("status", ["pending", "running", "failed"]);
  const c = connections.data?.find(
    (p: { user_id: string }) => p.user_id === user.id,
  );
  const parsedProfile = profileSchema.safeParse(profile.data?.config);
  const strategy = strategySchema.safeParse(settings.data?.config);
  const data: EngineData = {
    name: member.display_name || "Teammate",
    company: org.name,
    admin,
    ready: engineReady(),
    setupError: !!settings.error,
    strategy:
      admin && strategy.success
        ? strategy.data
        : { ...defaultStrategy, enabled: !!settings.data?.enabled },
    profile: parsedProfile.success
      ? {
          config: parsedProfile.data,
          enrolled: profile.data.enrolled,
          paused: profile.data.paused,
          onboarding_step: profile.data.onboarding_step,
          preferences: profile.data.preferences,
        }
      : null,
    sources: (sources.data || []).map((s) => ({
      ...s,
      is_owner: s.user_id === user.id,
    })),
    ideas: ideas.data || [],
    drafts: (drafts || []).map((d) => {
      const m = meta.data!.find((m) => m.draft_id === d.id)!;
      return {
        ...d,
        ...m,
        is_owner: d.user_id === user.id,
        id: d.id,
        url: d.linkedin_url,
        publish_status: d.status,
        scheduled_at: publicationJobs?.find((j) => j.draft_id === d.id)?.run_at,
        schedule_status: publicationJobs?.find((j) => j.draft_id === d.id)
          ?.status,
        versions: (versions.data || []).filter((v) => v.draft_id === d.id),
      } as EngineDraft;
    }),
    jobs: jobs.data || [],
    metrics: metrics.data || [],
    connections: (["linkedin", "x"] as const).flatMap((channel) =>
      c?.[channel + "_name"]
        ? [
            {
              channel,
              name: c[channel + "_name"],
              expired:
                Date.parse(c[channel + "_expires"]) <
                Date.parse(new Date().toISOString()),
            },
          ]
        : [],
    ),
    adminReport: report.data,
  };
  return (
    <>
      {notice && (
        <p role="status" className="live-notice">
          {notice === "published"
            ? "Published to your social account."
            : notice === "saved"
              ? "Schedule saved."
              : notice === "uncertain"
                ? "Delivery is uncertain. Check your social profile before trying anything else."
                : notice.startsWith("rejected-")
                  ? "The network rejected this attempt. " +
                    connectionNotice(notice.slice(9))
                  : notice === "not-saved"
                    ? "Could not save. Check approval, date, source permissions and connection."
                    : connectionNotice(notice)}
        </p>
      )}
      <ContentEngine data={data} />
    </>
  );
}
