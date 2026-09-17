import { z } from "zod";
import { demoData } from "@/lib/demo/data";
export const personStats = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  posts: z.number(),
  clicks: z.number(),
  leads: z.number(),
  views: z.number().nullable(),
  sales: z.number().nullable(),
});
export const reportSchema = z.object({
  people: z.array(personStats),
  posts: z.array(
    z.object({
      id: z.string(),
      user_id: z.string(),
      body: z.string(),
      channel: z.enum(["linkedin", "x"]),
      url: z.string().nullable(),
      date: z.string(),
      author: z.string(),
    }),
  ),
  feed_limit: z.number(),
});
export type Report = z.infer<typeof reportSchema>;
export function dateRange(
  start?: string,
  end?: string,
  today = new Date().toISOString().slice(0, 10),
) {
  const schema = z.iso.date();
  const to = schema.safeParse(end);
  const from = schema.safeParse(start);
  const last = to.success ? to.data : today;
  const first = from.success ? from.data : last.slice(0, 8) + "01";
  if (first > last || (Date.parse(last) - Date.parse(first)) / 86400000 > 366)
    return { start: today.slice(0, 8) + "01", end: today };
  return { start: first, end: last };
}
export function demoReport(start: string, end: string): Report {
  const inside = (date: string) =>
    date.slice(0, 10) >= start && date.slice(0, 10) <= end;
  const posts = demoData.posts.filter(
    (p) => p.status === "published" && inside(p.date),
  );
  const people = demoData.teammates.map((p, index) => ({
    id: p.id,
    name: p.name,
    role: p.title,
    posts: posts.filter((d) => d.userId === p.id).length,
    clicks: demoData.clicks.filter(
      (c) => c.userId === p.id && !c.isBot && !c.isDuplicate && inside(c.date),
    ).length,
    leads: demoData.conversions.filter(
      (c) => c.userId === p.id && c.status === "active" && inside(c.date),
    ).length,
    views: posts.filter((d) => d.userId === p.id).length * (1200 + index * 171),
    sales: posts.filter((d) => d.userId === p.id).length > 0 ? index % 3 : 0,
  }));
  return {
    people,
    posts: posts.map((p) => ({
      id: p.id,
      user_id: p.userId,
      body:
        Number(p.id.split("-")[1]) % 3 === 0
          ? p.body.slice(0, 250) + "…"
          : p.body,
      channel: Number(p.id.split("-")[1]) % 3 === 0 ? "x" : "linkedin",
      url: null,
      date: p.date,
      author: people.find((t) => t.id === p.userId)!.name,
    })),
    feed_limit: 500,
  };
}
export function rankPeople(
  people: Report["people"],
  metric: keyof Pick<
    Report["people"][number],
    "posts" | "views" | "clicks" | "leads" | "sales"
  >,
) {
  const sorted = [...people].sort(
    (a, b) =>
      (b[metric] ?? -1) - (a[metric] ?? -1) || a.name.localeCompare(b.name),
  );
  return sorted.map((person, i) => ({
    ...person,
    rank:
      person[metric] === null
        ? null
        : sorted.findIndex((p) => p[metric] === person[metric]) + 1,
    index: i,
  }));
}
