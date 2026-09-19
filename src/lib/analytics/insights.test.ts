import { expect, it } from "vitest";
import { breakoutPosts } from "./insights";
import type { Report } from "@/lib/v1/report";
const post = (
  day: number,
  value: number,
  user = "author",
  hours = 24,
): Report["posts"][number] => ({
  id: String(day),
  user_id: user,
  body: "Example",
  channel: "x",
  url: null,
  date: new Date(Date.UTC(2026, 8, day)).toISOString(),
  author: user,
  analytics: {
    lifetime: value,
    growth: null,
    lastSync: null,
    from: null,
    to: null,
    history: [
      {
        observed_at: new Date(Date.UTC(2026, 8, day, hours)).toISOString(),
        impressions: value,
      },
    ],
  },
});
it("waits for five prior same-author/channel, similarly aged observations", () => {
  expect(breakoutPosts([post(1, 100), post(2, 300)])).toEqual([]);
  expect(
    breakoutPosts([
      ...Array.from({ length: 5 }, (_, i) => post(i + 1, 100)),
      post(7, 300),
    ])[0],
  ).toMatchObject({ id: "7", ratio: 3, samples: 5 });
  expect(
    breakoutPosts([
      ...Array.from({ length: 5 }, (_, i) => post(i + 1, 100, "someone-else")),
      post(7, 300),
    ]),
  ).toEqual([]);
  expect(
    breakoutPosts([
      ...Array.from({ length: 5 }, (_, i) => post(i + 1, 100, "author", 40)),
      post(7, 300),
    ]),
  ).toEqual([]);
});
it("does not manufacture breakout claims from zero baselines or later posts", () => {
  expect(
    breakoutPosts([
      ...Array.from({ length: 5 }, (_, i) => post(i + 1, 0)),
      post(7, 300),
    ]),
  ).toEqual([]);
  expect(
    breakoutPosts([
      post(1, 300),
      ...Array.from({ length: 5 }, (_, i) => post(i + 2, 100)),
    ]),
  ).toEqual([]);
});
