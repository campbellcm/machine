import type { Report } from "@/lib/v1/report";
// Compare same-author, same-channel observations at 24–48 hours, not lifetime totals.
export function breakoutPosts(posts: Report["posts"]) {
  const observed = posts.flatMap((p) => {
    const sample = p.analytics?.history
      .filter((s) => {
        const age = Date.parse(s.observed_at) - Date.parse(p.date);
        return age >= 86400000 && age <= 172800000 && s.impressions !== null;
      })
      .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at))[0];
    return sample
      ? [
          {
            post: p,
            age: Date.parse(sample.observed_at) - Date.parse(p.date),
            value: sample.impressions!,
          },
        ]
      : [];
  });
  return observed.flatMap((current) => {
    const previous = observed
      .filter(
        (p) =>
          p.post.user_id === current.post.user_id &&
          p.post.channel === current.post.channel &&
          Date.parse(p.post.date) < Date.parse(current.post.date) &&
          Math.abs(p.age - current.age) <= 6 * 3600000,
      )
      .slice()
      .sort((a, b) => Date.parse(b.post.date) - Date.parse(a.post.date))
      .slice(0, 20);
    if (previous.length < 5) return [];
    const values = previous.map((p) => p.value).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const median =
      values.length % 2
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2;
    if (median < 50 || current.value < 100 || current.value < median * 2)
      return [];
    return [
      {
        id: current.post.id,
        author: current.post.author,
        ratio: current.value / median,
        baseline: median,
        samples: previous.length,
        impressions: current.value,
      },
    ];
  });
}
export function formatLesson(body: string) {
  if (body.includes("?"))
    return "This post invites a response with a question. Try a different question grounded in your own experience.";
  if (body.includes("\n\n"))
    return "Short sections make this example easy to scan. Test that structure with a new topic in your own voice.";
  return "This example presents one focused idea. Try a similarly focused post using your own approved evidence.";
}
