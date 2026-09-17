import { describe, it, expect } from "vitest";
import { createDemoData, demoSchema } from "./data";
import { activity, summarize } from "./metrics";
describe("M0 synthetic seed", () => {
  it("is deterministic and contains the required foundation entities", () => {
    const a = createDemoData();
    expect(a).toEqual(createDemoData());
    expect(a.teammates).toHaveLength(12);
    expect(a.posts.length).toBeGreaterThan(0);
    expect(a.clicks.length).toBeGreaterThan(0);
    expect(a.conversions.length).toBeGreaterThan(0);
    expect(a.challenge.metric).toBe("leads");
  });
  it("has valid references and no activity for teammates who have not opted in", () => {
    const d = createDemoData();
    for (const p of d.posts)
      expect(d.teammates.find((t) => t.id === p.userId)?.optedIn).toBe(true);
    for (const c of d.clicks)
      expect(d.posts.find((p) => p.id === c.postId)?.userId).toBe(c.userId);
    for (const c of d.conversions)
      expect(d.clicks.find((k) => k.id === c.clickId)?.userId).toBe(c.userId);
  });
  it("rejects malformed fixture statuses", () => {
    const d = createDemoData();
    expect(
      demoSchema.safeParse({
        ...d,
        posts: [{ ...d.posts[0], status: "unknown" }],
      }).success,
    ).toBe(false);
  });
});
describe("demo reporting", () => {
  it("excludes bot clicks, duplicates, reversed conversions and unpublished drafts", () => {
    const d = createDemoData();
    const baseline = summarize(d, "all");
    d.clicks.push(
      { ...d.clicks[0], id: "bot", isBot: true, isDuplicate: false },
      { ...d.clicks[0], id: "duplicate", isBot: false, isDuplicate: true },
    );
    d.conversions.push({
      ...d.conversions[0],
      id: "reversed",
      status: "reversed",
    });
    d.posts.push({ ...d.posts[0], id: "draft", status: "draft" });
    expect(summarize(d, "all")).toEqual(baseline);
  });
  it("reconciles team totals, individual totals and chart totals", () => {
    const d = createDemoData();
    for (const period of ["month", "all"] as const) {
      const all = summarize(d, period);
      const rows = d.teammates.map((t) => summarize(d, period, t.id));
      for (const key of ["posts", "clicks", "leads"] as const)
        expect(rows.reduce((sum, row) => sum + row[key], 0)).toBe(all[key]);
      expect(activity(d, period).reduce((sum, b) => sum + b.count, 0)).toBe(
        all.clicks,
      );
    }
  });
  it("filters dates at the organization-local month boundary", () => {
    const d = createDemoData();
    d.posts = [
      { ...d.posts[0], date: "2026-09-01T03:59:59.000Z" },
      { ...d.posts[0], date: "2026-09-01T04:00:00.000Z" },
      { ...d.posts[0], date: "2026-10-01T04:00:00.000Z" },
    ];
    expect(summarize(d, "month").posts).toBe(1);
  });
  it("handles empty datasets without invalid percentages", () => {
    const d = createDemoData();
    expect(
      summarize(
        { ...d, teammates: [], posts: [], clicks: [], conversions: [] },
        "month",
      ),
    ).toEqual({ posts: 0, clicks: 0, leads: 0, optedIn: 0, participation: 0 });
  });
});
