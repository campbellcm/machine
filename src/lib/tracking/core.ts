import { createHmac } from "node:crypto";
export function isBot(agent: string) {
  return /bot|crawler|spider|preview|headless|monitor|uptime|slack|facebookexternalhit|linkedinbot/i.test(
    agent,
  );
}
export function visitorHash(
  ip: string,
  agent: string,
  salt: string,
  now = new Date(),
) {
  if (salt.length < 32) throw new Error("Visitor salt setup required");
  const monthly = createHmac("sha256", salt)
    .update(now.toISOString().slice(0, 7))
    .digest();
  return createHmac("sha256", monthly)
    .update(ip + "\n" + agent)
    .digest("hex");
}
export function destinationUrl(
  destination: string,
  campaign: string,
  slug: string,
  click?: string,
) {
  const url = new URL(destination);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("HTTPS destination required");
  url.searchParams.set("utm_source", "linkedin");
  url.searchParams.set("utm_medium", "employee_advocacy");
  url.searchParams.set("utm_campaign", campaign);
  url.searchParams.set("utm_content", slug);
  if (click) url.searchParams.set("cc_click", click);
  else url.searchParams.delete("cc_click");
  return url;
}
