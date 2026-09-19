import { SourceImports } from "@/components/content-engine/source-imports";
import { formatLesson } from "@/lib/analytics/insights";
import { saveExample } from "./example-actions";
import { createBrief } from "./content-actions";
import { emailDeliveryReady } from "@/lib/delivery/worker";
import { slackConfig } from "@/lib/delivery/slack";
import { disconnectSlack } from "@/lib/delivery/actions";
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
  searchParams: Promise<{ notice?: string; view?: string }>;
}) {
  const { notice, view } = await searchParams;
  const { db, org, user, member } = await workspace();
  const [
    { data: examples, error: examplesError },
    { data: published },
    { data: attribution },
  ] = await Promise.all([
    db.rpc("post_examples", { org: org.id }),
    db.rpc("teammate_public_posts", { org: org.id, person: user.id }),
    db.rpc("published_post_attribution", { org: org.id }),
  ]);
  const savedExamples = (examples || []) as {
    id: string;
    note: string;
    body: string;
    channel: string;
    author: string;
  }[];
  const ownResults = (
    (published || []) as { id: string; body: string; channel: string }[]
  )
    .map((p) => ({
      ...p,
      clicks: Number(
        (attribution || []).find(
          (a: { draft_id: string }) => a.draft_id === p.id,
        )?.clicks || 0,
      ),
    }))
    .filter((p) => p.clicks >= 5)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 3);
  // Server-side report window.
  // eslint-disable-next-line react-hooks/purity
  const insightStart = new Date(Date.now() - 30 * 86400000).toISOString();
  const { count: editCount } = await db
    .from("ce_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("user_id", user.id)
    .eq("action", "edit")
    .gte("created_at", insightStart);
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
  const { data: campaigns } = await db
    .from("campaigns")
    .select("id,name")
    .eq("organization_id", org.id)
    .eq("active", true);
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
  const [slack, deliveryHistory] = await Promise.all([
    db.rpc("slack_delivery_status", { org: org.id }),
    db
      .from("draft_deliveries")
      .select("id,channel,status,created_at,issue")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const parsedProfile = profileSchema.safeParse(profile.data?.config);
  const strategy = strategySchema.safeParse(settings.data?.config);
  const data: EngineData = {
    name: member.display_name || "Teammate",
    company: org.name,
    admin,
    campaigns: campaigns || [],
    ready: engineReady(),
    setupError: !!settings.error,
    delivery: {
      emailReady: emailDeliveryReady(),
      slackConnected: !!slack.data?.connected,
      history: deliveryHistory.data || [],
    },
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
      {admin && (
        <details className="live-card">
          <summary>Company campaign brief</summary>
          <p>
            Set a shared objective and audience. Each teammate gets angles
            shaped by their role and voice. This replaces the current campaign
            direction; existing approvals need review again.
          </p>
          <form action={createBrief}>
            <label>
              Campaign title
              <input name="title" required minLength={3} maxLength={120} />
            </label>
            <label>
              Objective
              <textarea
                name="objective"
                required
                minLength={3}
                maxLength={400}
              />
            </label>
            <label>
              Audience
              <textarea
                name="audience"
                required
                minLength={3}
                maxLength={400}
              />
            </label>
            <label>
              Approved facts
              <textarea
                name="facts"
                required
                minLength={30}
                maxLength={12000}
              />
            </label>
            <label>
              Call to action
              <textarea name="cta" required minLength={3} maxLength={400} />
            </label>
            <label>
              <input type="checkbox" name="approved" required />I have
              permission to share these facts with the team and use them in
              external posts. I have removed confidential and personal
              information.
            </label>
            <p>
              Enroll your own AI profile first. Facts become an approved shared
              source, separate from campaign preferences. No post is approved or
              published by this action.
            </p>
            <button className="live-button">Save campaign brief</button>
          </form>
        </details>
      )}
      <details className="live-card">
        <summary>Learn from your published work</summary>
        <p>
          These suggestions use your latest 20 shared publications and lifetime
          tracked clicks. Different post ages and audiences affect results; this
          is an experiment to try, not proof of what caused performance.
        </p>
        {ownResults.length ? (
          ownResults.map((p) => (
            <article className="live-card" key={p.id}>
              <strong>
                {p.clicks} unique tracked clicks · {p.channel}
              </strong>
              <p>{p.body.slice(0, 180)}…</p>
              <p>{formatLesson(p.body)}</p>
              <p>
                Revisit this topic with a new approved insight. Your more/less
                feedback and editing preferences continue to shape your own
                suggestions.
              </p>
            </article>
          ))
        ) : (
          <p>
            Once one of your recent posts has at least five tracked clicks,
            we’ll show its evidence here. Keep reviewing drafts and giving topic
            feedback in the meantime.
          </p>
        )}
        {!!editCount && editCount >= 3 && (
          <p>
            You edited drafts {editCount} times in the last 30 days. Review your
            voice examples in Content preferences and add the phrases you kept.
            Edit count does not measure writing quality.
          </p>
        )}
        <h2>Your saved examples</h2>
        <p>
          Save team posts from Home → Post details. Examples are inspiration,
          not permission to copy claims or another employee’s experience.
        </p>
        {examplesError ? (
          <p>
            Saved examples are unavailable. Apply the latest database update.
          </p>
        ) : (
          savedExamples.map((p) => (
            <article className="live-card" key={p.id}>
              <strong>
                {p.author} · {p.channel}
              </strong>
              <details>
                <summary>{p.body.slice(0, 140)}…</summary>
                <p style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>
              </details>
              <p>{formatLesson(p.body)}</p>
              {p.note && <p>Your note: {p.note}</p>}
              <form action={saveExample}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="remove" value="yes" />
                <button className="live-button secondary">
                  Remove saved example
                </button>
              </form>
            </article>
          ))
        )}
        {!examplesError && !savedExamples.length && (
          <p>No examples saved yet.</p>
        )}
      </details>
      <SourceImports />
      <ContentEngine
        key={org.id + (view || "")}
        data={data}
        initialView={view === "drafts" ? "Drafts" : "Setup"}
      />
      <details className="live-card">
        <summary>Draft delivery connections & history</summary>
        <p>
          Email notifications go to your verified sign-in email. Slack
          notifications go only to the Slack account you connect. Messages link
          to private review in this app; they do not publish posts or include
          source notes.
        </p>
        <p>
          Email:{" "}
          {emailDeliveryReady()
            ? "Sender configured · first delivery still needs verification"
            : "Company sender setup required"}
          . Slack: {slack.data?.connected ? "Connected" : "Not connected"}.
        </p>
        {slack.data?.connected ? (
          <form action={disconnectSlack}>
            <button className="live-button secondary">
              Disconnect Slack delivery
            </button>
          </form>
        ) : slackConfig() ? (
          <form action="/api/delivery/slack/connect" method="post">
            <button className="live-button">Connect my Slack for drafts</button>
          </form>
        ) : (
          <a href="/setup">Set up Slack delivery</a>
        )}
        <p>iMessage is deferred. You can always review drafts here.</p>
        {deliveryHistory.error ? (
          <p>Apply the latest delivery migration.</p>
        ) : (
          data.delivery?.history.map((d) => (
            <p key={d.id}>
              {new Date(d.created_at).toLocaleDateString()} · {d.channel} ·{" "}
              {d.status}
              {d.issue ? ` · ${d.issue}` : ""}
            </p>
          ))
        )}
      </details>
    </>
  );
}
