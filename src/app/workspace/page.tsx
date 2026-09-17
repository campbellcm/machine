import { workspace } from "@/lib/supabase/server";
import { dateRange, reportSchema } from "@/lib/v1/report";
import { HomeDashboard } from "@/components/v1/home";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { db, org } = await workspace();
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
  return (
    <HomeDashboard report={parsed.data} {...range} timezone={org.timezone} />
  );
}
