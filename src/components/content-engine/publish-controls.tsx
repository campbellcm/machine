"use client";
import { useState } from "react";
import {
  publishLinkedIn,
  scheduleLinkedIn,
  cancelScheduled,
} from "@/lib/social/actions";
import type { EngineDraft } from "@/lib/content-engine/types";
export function PublishControls({
  draft: d,
  disabled = false,
}: {
  draft: EngineDraft;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState("");
  const stamp = local ? Date.parse(local) : NaN;
  const time = Number.isFinite(stamp) ? new Date(stamp).toISOString() : "";
  const fields = (
    <>
      <input type="hidden" name="id" value={d.id} />
      <input type="hidden" name="revision" value={d.revision} />
      <input type="hidden" name="channel" value={d.channel} />
      <input type="hidden" name="return_to" value="ai" />
    </>
  );
  if (
    d.publish_status === "publish_uncertain" ||
    d.publish_status === "publishing"
  )
    return (
      <p role="status">
        {d.publish_status === "publishing"
          ? "Publishing is in progress."
          : "Delivery is uncertain. Check your social profile. This post will not be retried automatically."}
      </p>
    );
  if (d.publish_status !== "approved" || d.state !== "approved" || !d.is_owner)
    return null;
  return (
    <details className="live-card">
      <summary>Publish or schedule this approved post</summary>
      {d.schedule_status === "pending" && (
        <form action={cancelScheduled}>
          {fields}
          <p>
            Scheduled for {new Date(d.scheduled_at!).toLocaleString()} (your
            device timezone).
          </p>
          <button className="live-button secondary">Cancel schedule</button>
        </form>
      )}
      {d.schedule_status === "failed" && (
        <p>
          Scheduled delivery needs attention. Check your connection, then choose
          a new time or publish now.
        </p>
      )}
      <fieldset disabled={disabled}>
        <form action={publishLinkedIn}>
          {fields}
          <label>
            <input type="checkbox" name="confirmed" required />
            Publish this exact approved text to my{" "}
            {d.channel === "x" ? "X" : "LinkedIn"} account now.
          </label>
          <button className="live-button">Publish now</button>
        </form>
        <form action={scheduleLinkedIn}>
          {fields}
          <label>
            Date and time (your device timezone)
            <input
              type="datetime-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              required
            />
          </label>
          <input type="hidden" name="publish_at" value={time} />
          <p>
            {time
              ? `Scheduled instant: ${time}`
              : "Choose between one minute and 90 days ahead."}{" "}
            Delivery runs in 15-minute slots; busy queues may delay posting.
          </p>
          <button className="live-button secondary" disabled={!time}>
            Schedule approved post
          </button>
        </form>
      </fieldset>
    </details>
  );
}
export function PublishingCalendar({ drafts }: { drafts: EngineDraft[] }) {
  const rows = drafts
    .filter((d) => d.is_owner && d.scheduled_at)
    .sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!));
  return (
    <section className="live-card">
      <h2>Your publishing calendar</h2>
      <p>
        Scheduled posts and delivery issues, in your device timezone. You retain
        final control.
      </p>
      {rows.map((d) => (
        <article className="team-row" key={d.id}>
          <div>
            <strong>{new Date(d.scheduled_at!).toLocaleString()}</strong>
            <p>
              {d.channel === "x" ? "X" : "LinkedIn"} · {d.schedule_status}
            </p>
            <p>{d.body.slice(0, 120)}…</p>
          </div>
          {d.schedule_status === "pending" && (
            <form action={cancelScheduled}>
              <input type="hidden" name="id" value={d.id} />
              <input type="hidden" name="return_to" value="ai" />
              <button className="live-button secondary">Cancel schedule</button>
            </form>
          )}
        </article>
      ))}
      {!rows.length && (
        <p>
          No posts scheduled. Review a draft, approve it, then choose a time.
        </p>
      )}
    </section>
  );
}
