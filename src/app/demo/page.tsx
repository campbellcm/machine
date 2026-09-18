import { previousPeriod } from "@/lib/analytics/metrics";
import { HomeDashboard } from "@/components/v1/home";
import { dateRange, demoReport } from "@/lib/v1/report";
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const q = await searchParams;
  const range = dateRange(q.start, q.end, "2026-09-17");
  return (
    <HomeDashboard
      report={demoReport(range.start, range.end)}
      previous={demoReport(
        previousPeriod(range.start, range.end).start,
        previousPeriod(range.start, range.end).end,
      )}
      {...range}
      demo
      timezone="America/New_York"
    />
  );
}
