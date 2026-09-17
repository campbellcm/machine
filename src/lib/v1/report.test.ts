import { describe, it, expect } from "vitest";
import { dateRange, demoReport, rankPeople } from "./report";
describe("V1 report filters and rankings", () => {
  it("uses inclusive dates and refuses reversed or oversized ranges", () => {
    expect(dateRange("2026-09-10", "2026-09-01", "2026-09-17")).toEqual({
      start: "2026-09-01",
      end: "2026-09-17",
    });
    expect(demoReport("2026-09-17", "2026-09-17").posts).toHaveLength(0);
    const report = demoReport("2026-09-01", "2026-09-16");
    expect(report.people.reduce((n, p) => n + p.posts, 0)).toBe(
      report.posts.length,
    );
    expect(report.people.reduce((n, p) => n + p.clicks, 0)).toBe(690);
  });
  it("shows shared rank for ties and no rank for unavailable values", () => {
    const people = demoReport("2026-09-01", "2026-09-16")
      .people.slice(0, 3)
      .map((p, i) => ({ ...p, views: i === 2 ? null : 10 }));
    expect(rankPeople(people, "views").map((p) => p.rank)).toEqual([
      1,
      1,
      null,
    ]);
  });
});
