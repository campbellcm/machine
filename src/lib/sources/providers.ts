import "server-only";
import { z } from "zod";
import { redact } from "@/lib/content-engine/domain";
async function body(r: Response) {
  if (!r.ok) throw new Error("Provider unavailable");
  const text = await r.text();
  if (text.length > 500000) throw new Error("Choose a shorter excerpt");
  return JSON.parse(text);
}
export async function fetchFathom(token: string, recording: string) {
  const id = z
    .string()
    .regex(/^\d{1,20}$/)
    .parse(recording);
  const result = z
    .object({ transcript: z.array(z.object({ text: z.string() })).max(5000) })
    .parse(
      await body(
        await fetch(
          `https://api.fathom.ai/external/v1/recordings/${id}/transcript`,
          {
            headers: { "X-Api-Key": token },
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          },
        ),
      ),
    );
  // Speaker names, invitees and email metadata never enter the staging record.
  const text = redact(result.transcript.map((p) => p.text).join("\n"));
  if (text.length > 16000)
    throw new Error("Use a selected excerpt for longer recordings");
  return text;
}
export function slackMessageRef(value: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    !u.hostname.endsWith(".slack.com") ||
    u.username ||
    u.password
  )
    throw new Error("Slack link required");
  const match = u.pathname.match(
    /^\/archives\/(C[A-Z0-9]+)\/p(\d{10})(\d{6})$/,
  );
  if (!match) throw new Error("Select a public-channel message");
  return { channel: match[1], ts: match[2] + "." + match[3] };
}
export async function fetchSlackMessage(token: string, link: string) {
  const ref = slackMessageRef(link);
  const infoUrl = new URL("https://slack.com/api/conversations.info");
  infoUrl.searchParams.set("channel", ref.channel);
  const info = z
    .object({
      ok: z.literal(true),
      channel: z.object({
        id: z.string(),
        is_private: z.boolean(),
        is_im: z.boolean(),
        is_mpim: z.boolean(),
      }),
    })
    .parse(
      await body(
        await fetch(infoUrl, {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        }),
      ),
    );
  if (
    info.channel.id !== ref.channel ||
    info.channel.is_private ||
    info.channel.is_im ||
    info.channel.is_mpim
  )
    throw new Error("Select a public channel");
  const url = new URL("https://slack.com/api/conversations.history");
  url.search = new URLSearchParams({
    channel: ref.channel,
    latest: ref.ts,
    inclusive: "true",
    limit: "1",
  }).toString();
  const result = z
    .object({
      ok: z.literal(true),
      messages: z
        .array(
          z.object({
            ts: z.string(),
            text: z.string().optional(),
            subtype: z.string().optional(),
          }),
        )
        .max(1),
    })
    .parse(
      await body(
        await fetch(url, {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        }),
      ),
    );
  const message = result.messages[0];
  if (!message || message.ts !== ref.ts || message.subtype)
    throw new Error("Selected message unavailable");
  return redact(
    (message.text || "")
      .replace(/<@[A-Z0-9]+>/g, "[person]")
      .replace(/<[^>|]+\|([^>]+)>/g, "$1"),
  );
}
