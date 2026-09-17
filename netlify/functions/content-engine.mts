export default async function handler() {
  const secret = Netlify.env.get("CRON_SECRET"),
    origin = Netlify.env.get("URL");
  if (!secret || !origin) return new Response(null, { status: 204 });
  const result = await fetch(new URL("/api/jobs/content-engine", origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(25000),
  });
  if (!result.ok) throw new Error("Content processing unavailable");
  return new Response(null, { status: 204 });
}
export const config = { schedule: "3,18,33,48 * * * *" };
