import { it, expect } from "vitest";
import { snapshotSummary, previousPeriod, changeLabel } from "./metrics";
it("does not treat initial lifetime impressions or corrected counters as new activity", () => {
  const a = { observed_at: "2026-09-01T12:00:00Z", impressions: 100 };
  expect(
    snapshotSummary([a], "2026-09-01", "2026-09-30", "UTC").growth,
  ).toBeNull();
  expect(
    snapshotSummary(
      [a, { ...a, observed_at: "2026-09-02T12:00:00Z", impressions: 90 }],
      "2026-09-01",
      "2026-09-30",
      "UTC",
    ).growth,
  ).toBeNull();
});
it("uses observations inside company-local dates and separates latest lifetime totals", () => {
  const samples = [
    { observed_at: "2026-09-01T01:00:00Z", impressions: 10 },
    { observed_at: "2026-09-01T12:00:00Z", impressions: 100 },
    { observed_at: "2026-09-02T12:00:00Z", impressions: 130 },
    { observed_at: "2026-10-01T12:00:00Z", impressions: 300 },
  ];
  expect(
    snapshotSummary(samples, "2026-09-01", "2026-09-30", "America/New_York"),
  ).toMatchObject({ growth: 30, lifetime: 300 });
});
it("compares equal date windows without dividing by zero", () => {
  expect(previousPeriod("2026-03-01", "2026-03-07")).toEqual({
    start: "2026-02-22",
    end: "2026-02-28",
  });
  expect(changeLabel(10, 0)).toBe("New activity");
  expect(changeLabel(1, null)).toBe("Comparison unavailable");
});

import { addTrackedPosts } from "./report";
it("keeps imported feed assembly separate from authoritative counts", () => {
  const report = {
    people: [
      {
        id: "u",
        name: "A",
        role: "R",
        posts: 900,
        views: null,
        sales: null,
        clicks: 0,
        leads: 0,
      },
    ],
    posts: [],
    feed_limit: 500,
  };
  const row = {
    id: "t",
    user_id: "u",
    provider: "x" as const,
    provider_post_id: "123",
    body: "Post",
    published_at: "2026-09-18T12:00:00Z",
    url: "https://x.com/i/status/123",
    participating: true,
    observed_at: "2026-09-18T12:00:00Z",
    post_snapshots: [],
  };
  expect(
    addTrackedPosts(report, [row], "2026-09-01", "2026-09-30", "UTC").people[0]
      .posts,
  ).toBe(900);
  expect(
    addTrackedPosts(
      report,
      [{ ...row, participating: false }],
      "2026-09-01",
      "2026-09-30",
      "UTC",
    ).posts,
  ).toHaveLength(0);
});
