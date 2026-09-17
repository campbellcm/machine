import { z } from "zod";

const teammateSchema = z.object({
  id: z.string(),
  name: z.string(),
  initials: z.string(),
  title: z.string(),
  department: z.string(),
  color: z.enum(["blue", "purple", "orange", "green"]),
  optedIn: z.boolean(),
});
const postSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  status: z.enum(["draft", "in_review", "published"]),
  date: z.iso.datetime(),
  angle: z.string(),
});
const clickSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  date: z.iso.datetime(),
  isBot: z.boolean(),
  isDuplicate: z.boolean(),
});
const conversionSchema = z.object({
  id: z.string(),
  clickId: z.string(),
  userId: z.string(),
  date: z.iso.datetime(),
  type: z.enum(["lead", "demo_booked"]),
  status: z.enum(["active", "reversed"]),
});
export const demoSchema = z.object({
  organization: z.object({
    id: z.string(),
    name: z.string(),
    timezone: z.string(),
  }),
  teammates: z.array(teammateSchema),
  posts: z.array(postSchema),
  clicks: z.array(clickSchema),
  conversions: z.array(conversionSchema),
  challenge: z.object({
    id: z.string(),
    name: z.string(),
    metric: z.literal("leads"),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    rewardType: z.literal("none"),
  }),
});
export type DemoData = z.infer<typeof demoSchema>;
export type Post = z.infer<typeof postSchema>;
export type Teammate = z.infer<typeof teammateSchema>;
const people = [
  ["Alex Morgan", "AM", "Product designer", "Product", "purple"],
  ["Sarah Chen", "SC", "Head of marketing", "Marketing", "blue"],
  ["Marcus Johnson", "MJ", "Account executive", "Sales", "orange"],
  ["Emily Park", "EP", "Customer success lead", "Customer success", "green"],
  ["David Rivera", "DR", "Engineering lead", "Engineering", "blue"],
  ["Priya Shah", "PS", "Product manager", "Product", "purple"],
  ["James Wilson", "JW", "Account executive", "Sales", "green"],
  ["Sofia Martinez", "SM", "Content strategist", "Marketing", "orange"],
  ["Noah Kim", "NK", "Software engineer", "Engineering", "purple"],
  [
    "Olivia Brooks",
    "OB",
    "Customer success manager",
    "Customer success",
    "blue",
  ],
  ["Ethan Wright", "EW", "Sales development", "Sales", "orange"],
  ["Ava Patel", "AP", "People operations", "People", "green"],
];
const stories = [
  [
    "The best feature we shipped was a question.",
    "At Acme, our product team tried something different this week: we paused the roadmap and listened.\n\nOne question changed the conversation: “What are you doing right before you open our product?”\n\nThe answers gave us more direction than another feature request ever could. Sometimes the most useful design tool is curiosity.\n\nWhat question has changed the way you work?",
    "Behind the scenes",
  ],
  [
    "Small wins deserve a bigger spotlight.",
    "Our team at Acme has been sharing one small win every Friday.\n\nNot the big launch or the perfect presentation. The thoughtful follow-up. The bug someone quietly fixed. The customer who finally felt heard.\n\nIt is a useful reminder that good work often happens between the milestones.\n\nWhat was your small win this week?",
    "Story",
  ],
  [
    "Listen for the problem behind the request.",
    "I work at Acme, and a recent customer conversation reminded me of a simple lesson.\n\nWhen someone asks for a new feature, it is tempting to jump straight to the solution. Instead, we asked them to walk us through their day.\n\nThe real problem was a handoff between teams. The solution was simpler than the original request.\n\nStart with understanding. The feature can wait.",
    "Lesson",
  ],
  [
    "A better handoff starts with context.",
    "At Acme, our team has been rethinking how we hand work from one person to the next.\n\nA checklist tells you what to do. Context tells you why it matters.\n\nWe started including the decision behind the task, not just the task itself. It has made the next conversation a better one.\n\nWhat context do you wish you had sooner?",
    "How-to",
  ],
];
export function createDemoData(): DemoData {
  const teammates = people.map(
    ([name, initials, title, department, color], i) => ({
      id: `member-${i + 1}`,
      name,
      initials,
      title,
      department,
      color,
      optedIn: i < 10,
    }),
  );
  const posts = Array.from({ length: 38 }, (_, i) => {
    const story = stories[i % stories.length];
    return {
      id: `post-${i + 1}`,
      userId: `member-${(i % 10) + 1}`,
      title: story[0],
      body: story[1],
      angle: story[2],
      status: i < 30 ? "published" : i < 36 ? "draft" : "in_review",
      date: `2026-${i < 6 ? "08" : "09"}-${String(i < 6 ? 25 + i : 1 + ((i * 3) % 16)).padStart(2, "0")}T10:00:00.000Z`,
    };
  });
  const clicks = Array.from({ length: 964 }, (_, i) => {
    const post = posts[i % 30];
    return {
      id: `click-${i + 1}`,
      postId: post.id,
      userId: post.userId,
      date: post.date,
      isBot: i % 23 === 0,
      isDuplicate: i % 17 === 0,
    };
  });
  const conversions = Array.from({ length: 43 }, (_, i) => {
    const click = clicks[1 + i * 19];
    return {
      id: `conversion-${i + 1}`,
      clickId: click.id,
      userId: click.userId,
      date: click.date,
      type: i % 4 === 0 ? "demo_booked" : "lead",
      status: i === 8 ? "reversed" : "active",
    };
  });
  return demoSchema.parse({
    organization: {
      id: "org-demo",
      name: "Acme",
      timezone: "America/New_York",
    },
    teammates,
    posts,
    clicks,
    conversions,
    challenge: {
      id: "challenge-demo",
      name: "September conversations",
      metric: "leads",
      startsAt: "2026-09-01T04:00:00.000Z",
      endsAt: "2026-10-01T04:00:00.000Z",
      rewardType: "none",
    },
  });
}
export const demoData = createDemoData();
