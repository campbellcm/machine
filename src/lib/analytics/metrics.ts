export type Snapshot = {
  observed_at: string;
  impressions: number | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
};
export function snapshotSummary(
  snapshots: Snapshot[],
  start: string,
  end: string,
  timezone: string,
) {
  const sorted = [...snapshots].sort(
    (a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at),
  );
  const day = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  const window = sorted.filter(
    (s) => day(s.observed_at) >= start && day(s.observed_at) <= end,
  );
  const first = window[0],
    last = window.at(-1),
    latest = sorted.at(-1);
  // A first lifetime reading is not period activity; counter corrections are not growth.
  const growth =
    window.length >= 2 &&
    window.every((s) => s.impressions !== null) &&
    window.every(
      (s, i) => i === 0 || s.impressions! >= window[i - 1].impressions!,
    )
      ? last!.impressions! - first!.impressions!
      : null;
  return {
    lifetime: latest?.impressions ?? null,
    growth,
    lastSync: latest?.observed_at ?? null,
    from: first?.observed_at ?? null,
    to: last?.observed_at ?? null,
  };
}
export function previousPeriod(start: string, end: string) {
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  return {
    start: new Date(Date.parse(start) - days * 86400000)
      .toISOString()
      .slice(0, 10),
    end: new Date(Date.parse(start) - 86400000).toISOString().slice(0, 10),
  };
}
export function changeLabel(current: number | null, previous: number | null) {
  if (current === null || previous === null) return "Comparison unavailable";
  if (previous === 0) return current === 0 ? "No change" : "New activity";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% vs previous period`;
}
