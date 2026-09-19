import { WeeklyDigest } from "@/components/v1/weekly-digest";
import { previousPeriod } from "@/lib/analytics/metrics";
import { addTrackedPosts, trackedSchema } from "@/lib/analytics/report";
import {
  selectWorkPost,
  setTracking,
  syncPosts,
} from "@/lib/analytics/actions";
import { workspace } from "@/lib/supabase/server";
import { dateRange, reportSchema } from "@/lib/v1/report";
import { HomeDashboard } from "@/components/v1/home";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    tracking?: string;
    digest?: string;
    importPage?: string;
  }>;
}) {
  const { db, org, user } = await workspace();
  const q = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: org.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const range = dateRange(q.start, q.end, today);
  const { data, error } = await db.rpc("home_report", {
    org: org.id,
    start_day: range.start,
    end_day: range.end,
  });
  const parsed = reportSchema.safeParse(data);
  if (error || !parsed.success)
    return (
      <section className="live-card">
        <h1>Home is waiting for your database update.</h1>
        <p>
          Apply the latest migrations in Setup, then refresh. We won’t show
          incomplete results as zero.
        </p>
        <a href="/setup">Open setup</a>
      </section>
    );
  const [{ data: photos }, { data: connections }] = await Promise.all([
    db.rpc("team_photos", { org: org.id }),
    db.rpc("team_connections", { org: org.id }),
  ]);
  const report = parsed.data;
  // Server component: evaluate credential expiry at request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  report.people = report.people.map((person) => {
    const photo = photos?.find(
      (p: { user_id: string }) => p.user_id === person.id,
    );
    const connection = connections?.find(
      (p: { user_id: string }) => p.user_id === person.id,
    );
    return {
      ...person,
      photo_url: photo?.photo_url,
      channels: [
        ...(connection?.linkedin_name &&
        (!connection.linkedin_expires ||
          Date.parse(connection.linkedin_expires) > now)
          ? ["linkedin" as const]
          : []),
        ...(connection?.x_name &&
        (!connection.x_expires || Date.parse(connection.x_expires) > now)
          ? ["x" as const]
          : []),
      ],
    };
  });
  const prior = previousPeriod(range.start, range.end);
  const importPage = Math.max(0, Math.min(1000, Number(q.importPage) || 0)) | 0;
  const [
    tracked,
    settings,
    previous,
    ownImports,
    counts,
    priorCounts,
    attribution,
  ] = await Promise.all([
    db
      .from("tracked_posts")
      .select("*,post_snapshots(observed_at,impressions)")
      .eq("organization_id", org.id)
      .eq("participating", true)
      .gte(
        "published_at",
        new Date(Date.parse(range.start) - 86400000).toISOString(),
      )
      .lt(
        "published_at",
        new Date(Date.parse(range.end) + 2 * 86400000).toISOString(),
      )
      .order("published_at", { ascending: false })
      .limit(500)
      .order("observed_at", {
        referencedTable: "post_snapshots",
        ascending: false,
      })
      .limit(180, { referencedTable: "post_snapshots" }),
    db
      .from("social_syncs")
      .select("*")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .eq("provider", "x")
      .maybeSingle(),
    db.rpc("home_report", {
      org: org.id,
      start_day: prior.start,
      end_day: prior.end,
    }),
    db
      .from("tracked_posts")
      .select("id,body,participating")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("published_at", { ascending: false })
      .order("id")
      .range(importPage * 25, importPage * 25 + 24),
    db.rpc("imported_post_counts", {
      org: org.id,
      start_day: range.start,
      end_day: range.end,
    }),
    db.rpc("imported_post_counts", {
      org: org.id,
      start_day: prior.start,
      end_day: prior.end,
    }),
    db.rpc("published_post_attribution", { org: org.id }),
  ]);
  const rows = trackedSchema.safeParse(tracked.data);
  const previousReport = reportSchema.safeParse(previous.data);
  const current = rows.success
    ? addTrackedPosts(report, rows.data, range.start, range.end, org.timezone)
    : report;
  const priorReport = previousReport.success
    ? rows.success
      ? addTrackedPosts(
          previousReport.data,
          rows.data,
          prior.start,
          prior.end,
          org.timezone,
        )
      : previousReport.data
    : undefined;
  if (counts.error || priorCounts.error || tracked.error || !rows.success)
    return (
      <section className="live-card">
        <h1>Tracking data is unavailable.</h1>
        <p>
          Check database setup and refresh. Incomplete totals are not shown as
          zero.
        </p>
        <a href="/setup">Open setup</a>
      </section>
    );
  for (const person of current.people)
    person.posts += Number(
      counts.data?.find((r: { user_id: string }) => r.user_id === person.id)
        ?.posts || 0,
    );
  for (const person of priorReport?.people || [])
    person.posts += Number(
      priorCounts.data?.find(
        (r: { user_id: string }) => r.user_id === person.id,
      )?.posts || 0,
    );
  for (const post of current.posts) {
    const attr = attribution.data?.find(
      (r: { draft_id: string }) => r.draft_id === post.id,
    );
    if (attr)
      post.attribution = {
        campaigns: attr.campaign_names,
        clicks: Number(attr.clicks),
        leads: Number(attr.leads),
      };
  }
  const own = (ownImports.data || []) as {
    id: string;
    body: string;
    participating: boolean;
  }[];
  return (
    <>
      <HomeDashboard
        report={current}
        previous={priorReport}
        {...range}
        timezone={org.timezone}
      />
      <WeeklyDigest notice={q.digest} />
      <details className="live-card">
        <summary>My connected posts & tracking</summary>
        <h2>You choose what joins the team feed.</h2>
        <p>
          Import up to 100 original X posts from the past 29 days. Imports are
          private until you include them. Replies and reposts are excluded.
          LinkedIn automatic import needs additional approved API access and is
          not enabled.
        </p>
        {q.tracking && (
          <p role="status">
            {q.tracking === "failed"
              ? "Could not save. Check setup and participation."
              : "Updated. Review the sync status below."}
          </p>
        )}
        {ownImports.error || settings.error ? (
          <p>Apply the latest database migrations to enable tracking.</p>
        ) : (
          <>
            <form action={setTracking}>
              <input
                type="hidden"
                name="enabled"
                value={settings.data?.enabled ? "false" : "true"}
              />
              <button className="live-button">
                {settings.data?.enabled
                  ? "Pause automatic tracking"
                  : "Enable my X post tracking"}
              </button>
            </form>
            {settings.data?.enabled && (
              <form action={syncPosts}>
                <button className="live-button secondary">
                  Sync my recent posts
                </button>
              </form>
            )}
            <p>
              Last successful sync:{" "}
              {settings.data?.last_success_at
                ? new Date(settings.data.last_success_at).toLocaleString(
                    "en-US",
                    { timeZone: org.timezone },
                  )
                : "Not synced"}
              .{" "}
              {settings.data?.issue
                ? `Sync notice: ${settings.data.issue.replaceAll("_", " ")}.`
                : ""}
            </p>
            <p>
              Automatic sync targets hourly updates with bounded queue capacity;
              busy queues can take longer. Historical snapshots are retained.
              Disconnecting stops future imports; pausing does not remove
              selected posts.
            </p>
            {own.map((p) => (
              <article key={p.id} className="live-card">
                <p>
                  {p.body.slice(0, 240)}
                  {p.body.length > 240 ? "…" : ""}
                </p>
                <small>
                  {p.participating
                    ? "Included in the team feed"
                    : "Private import"}
                </small>
                <form action={selectWorkPost}>
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    type="hidden"
                    name="include"
                    value={p.participating ? "false" : "true"}
                  />
                  <button className="live-button secondary">
                    {p.participating
                      ? "Remove from team feed"
                      : "Include this work post"}
                  </button>
                </form>
              </article>
            ))}
            <div className="live-inline">
              {importPage > 0 && (
                <a href={`?importPage=${importPage - 1}`}>Newer imports</a>
              )}
              {own.length === 25 && (
                <a href={`?importPage=${importPage + 1}`}>Older imports</a>
              )}
            </div>
            {!own.length && (
              <p>
                No imported posts yet. Connect X in Team, enable tracking, then
                sync.
              </p>
            )}
          </>
        )}
      </details>
    </>
  );
}
