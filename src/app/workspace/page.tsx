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
  const [{ data: photos }, { data: connections }] = await Promise.all([
    db.rpc("team_photos", { org: org.id }),
    db.rpc("team_connections", { org: org.id }),
  ]);
  const report = parsed.data;
  // Server component: evaluate credential expiry at request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  report.people = report.people.map(person => {
    const photo = photos?.find((p: { user_id: string }) => p.user_id === person.id);
    const connection = connections?.find((p: { user_id: string }) => p.user_id === person.id);
    return { ...person, photo_url: photo?.photo_url, channels: [
      ...(connection?.linkedin_name && (!connection.linkedin_expires || Date.parse(connection.linkedin_expires) > now) ? ["linkedin" as const] : []),
      ...(connection?.x_name && (!connection.x_expires || Date.parse(connection.x_expires) > now) ? ["x" as const] : []),
    ] };
  });
  return (
    <HomeDashboard report={report} {...range} timezone={org.timezone} />
  );
}
