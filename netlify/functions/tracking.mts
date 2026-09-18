export default async function handler() {
  const secret = Netlify.env.get("CRON_SECRET");
  const origin = Netlify.env.get("URL");
  if (!secret || !origin)
    return new Response("Setup required", { status: 503 });
  const response = await fetch(new URL("/api/jobs/tracking", origin), {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("Post tracking failed");
  return new Response(null, { status: 204 });
}
export const config = { schedule: "3,18,33,48 * * * *" };
