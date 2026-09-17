import type { DemoData } from "./data";
export type Period = "month" | "all";
export const inPeriod = (date: string, period: Period) =>
  period === "all" ||
  (date >= "2026-09-01T04:00:00.000Z" && date < "2026-10-01T04:00:00.000Z");
export function summarize(data: DemoData, period: Period, userId?: string) {
  const owns = (record: { userId: string }) =>
    !userId || record.userId === userId;
  const posts = data.posts.filter(
    (p) => p.status === "published" && owns(p) && inPeriod(p.date, period),
  );
  const clicks = data.clicks.filter(
    (c) => owns(c) && inPeriod(c.date, period) && !c.isBot && !c.isDuplicate,
  );
  const leads = data.conversions.filter(
    (c) => owns(c) && inPeriod(c.date, period) && c.status === "active",
  );
  const optedIn = data.teammates.filter((t) => t.optedIn).length;
  const active = new Set(posts.map((p) => p.userId)).size;
  return {
    posts: posts.length,
    clicks: clicks.length,
    leads: leads.length,
    optedIn,
    participation: optedIn ? Math.round((active / optedIn) * 100) : 0,
  };
}
export function activity(data: DemoData, period: Period) {
  const days =
    period === "month"
      ? ["01–04", "05–08", "09–12", "13–16"]
      : ["Aug 25–31", "Sep 01–04", "Sep 05–08", "Sep 09–12", "Sep 13–16"];
  const counts = days.map(() => 0);
  data.clicks
    .filter((c) => !c.isBot && !c.isDuplicate && inPeriod(c.date, period))
    .forEach((c) => {
      const month = Number(c.date.slice(5, 7));
      const day = Number(c.date.slice(8, 10));
      const bin =
        month === 8
          ? 0
          : Math.min(3, Math.floor((day - 1) / 4)) + (period === "all" ? 1 : 0);
      counts[bin]++;
    });
  return days.map((label, i) => ({ label, count: counts[i] }));
}
