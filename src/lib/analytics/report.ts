import { z } from "zod";
import type { Report } from "@/lib/v1/report";
import { snapshotSummary } from "./metrics";
export const trackedSchema = z.array(
  z.object({
    id: z.string(),
    user_id: z.string(),
    provider: z.enum(["x", "linkedin"]),
    provider_post_id: z.string(),
    body: z.string(),
    published_at: z.string(),
    url: z.string(),
    participating: z.boolean(),
    observed_at: z.string(),
    post_snapshots: z.array(
      z.object({ observed_at: z.string(), impressions: z.number().nullable() }),
    ),
  }),
);
export function addTrackedPosts(
  report: Report,
  rows: z.infer<typeof trackedSchema>,
  start: string,
  end: string,
  timezone: string,
): Report {
  const result: Report = {
    ...report,
    people: report.people.map((p) => ({ ...p })),
    posts: report.posts.map((p) => ({
      ...p,
      source: "Published through the workspace",
    })),
  };
  for (const row of rows.filter((r) => r.participating)) {
    const summary = snapshotSummary(row.post_snapshots, start, end, timezone);
    const match = result.posts.find(
      (p) =>
        p.channel === row.provider &&
        (p.url === row.url ||
          (row.provider === "x" &&
            p.url?.match(/\/status\/(\d+)/)?.[1] === row.provider_post_id)),
    );
    const analytics = {
      ...summary,
      history: row.post_snapshots
        .slice()
        .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at)),
    };
    if (match) {
      match.analytics = analytics;
      continue;
    }
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(row.published_at));
    if (day < start || day > end) continue;
    const person = result.people.find((p) => p.id === row.user_id);
    if (!person) continue;

    result.posts.push({
      id: row.id,
      user_id: row.user_id,
      body: row.body,
      channel: row.provider,
      url: row.url,
      date: row.published_at,
      author: person.name,
      source: "Connected account · selected by author",
      analytics,
    });
  }
  result.posts = result.posts
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, report.feed_limit);
  // Period exposure totals remain unavailable until coverage is complete across networks.
  return result;
}
