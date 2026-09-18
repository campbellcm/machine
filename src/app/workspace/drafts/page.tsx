import { connectionNotice } from "@/lib/social/health";
import Link from "next/link";
import { workspace } from "@/lib/supabase/server";
import { saveDraft, transitionDraft, recordManual } from "../actions";
import { attachLink } from "../campaigns/actions";
import { CopyPost } from "@/components/live-copy";
import {
  publishLinkedIn,
  scheduleLinkedIn,
  cancelScheduled,
} from "@/lib/social/actions";
export default async function Drafts({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { db, org, member, user } = await workspace();
  const { notice } = await searchParams;
  if (!member.opted_in_at && !["owner", "admin"].includes(member.role))
    return (
      <>
        <h1>Join before you start drafting.</h1>
        <Link href="/workspace/profile">Complete your profile</Link>
      </>
    );
  const { data: jobs } = await db
    .from("publish_jobs")
    .select("*")
    .eq("organization_id", org.id)
    .eq("status", "pending");
  const { data: campaigns } = await db
    .from("campaigns")
    .select("id,name")
    .eq("organization_id", org.id)
    .eq("active", true);
  const { data: drafts } = await db
    .from("drafts")
    .select("*")
    .eq("organization_id", org.id)
    .order("updated_at", { ascending: false });
  return (
    <>
      <h3>Make it sound like you.</h3>
      {notice && (
        <p role="status" className="live-notice">
          {notice.startsWith("rejected-")
            ? "The network rejected this attempt; it was not published. " +
              connectionNotice(notice.slice(9))
            : [
                  "reconnect",
                  "busy",
                  "setup",
                  "permissions",
                  "rate_limit",
                  "unavailable",
                  "connection-unavailable",
                ].includes(notice)
              ? connectionNotice(notice)
              : notice === "saved"
                ? "Saved."
                : notice === "published"
                  ? "Published."
                  : notice === "uncertain"
                    ? "The social network may have received this post. Check your profile before any further action. We will not retry automatically."
                    : notice === "not-configured"
                      ? "Connect your selected social account and complete service setup first."
                      : "Could not complete that action. Refresh and check the draft, disclosure, connection, and review requirements."}
        </p>
      )}
      {member.opted_in_at && (
        <form action={saveDraft} className="live-card">
          <h2>Start a draft</h2>
          <label>
            Channel
            <select name="channel">
              <option value="linkedin">LinkedIn</option>
              <option value="x">X</option>
            </select>
          </label>
          <label>
            Your post
            <textarea
              name="body"
              maxLength={3000}
              required
              defaultValue={`I work at ${org.name}.\n\n`}
            />
          </label>
          <small>
            3,000 characters maximum. Use only facts you have permission to
            share.
          </small>
          <button className="live-button">Save private draft</button>
        </form>
      )}
      {drafts?.map((d) => (
        <article className="live-card" key={d.id}>
          <span className="status">
            {d.channel === "x" ? "X · " : "LinkedIn · "}
            {d.status.replaceAll("_", " ")}
            {d.status === "published" && !d.verified ? " · unverified" : ""}
          </span>
          {d.user_id === user.id &&
          !["publishing", "publish_uncertain", "published"].includes(
            d.status,
          ) ? (
            <form action={saveDraft}>
              <input type="hidden" name="id" value={d.id} />
              <input
                type="hidden"
                name="channel"
                value={d.channel || "linkedin"}
              />
              <input type="hidden" name="revision" value={d.revision} />
              <label>
                Post text
                <textarea
                  name="body"
                  defaultValue={d.body}
                  required
                  maxLength={d.channel === "x" ? 280 : 3000}
                />
              </label>
              <button className="live-button secondary">
                Save changes · resets approval
              </button>
            </form>
          ) : (
            <pre>{d.body}</pre>
          )}
          {d.user_id === user.id &&
            !["publishing", "publish_uncertain", "published"].includes(
              d.status,
            ) &&
            !!campaigns?.length && (
              <form action={attachLink}>
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="hidden"
                  name="channel"
                  value={d.channel || "linkedin"}
                />
                <input type="hidden" name="revision" value={d.revision} />
                <label>
                  Campaign
                  <select name="campaign">
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="live-button secondary">
                  Add my tracked link
                </button>
              </form>
            )}
          {d.claims.length > 0 && (
            <>
              <h3>Verify before approving</h3>
              <ul>
                {d.claims.map((c: string) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {d.user_id === user.id &&
            ["draft", "changes_requested", "reviewed"].includes(d.status) && (
              <form action={transitionDraft}>
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="hidden"
                  name="channel"
                  value={d.channel || "linkedin"}
                />
                <input type="hidden" name="revision" value={d.revision} />
                <input
                  type="hidden"
                  name="operation"
                  value={
                    org.admin_review_required && d.status !== "reviewed"
                      ? "submit"
                      : "approve"
                  }
                />
                <label>
                  <input type="checkbox" required />I checked the facts and have
                  permission to share this saved text.
                </label>
                <button className="live-button">
                  {org.admin_review_required && d.status !== "reviewed"
                    ? "Submit for admin review"
                    : "Approve saved draft"}
                </button>
              </form>
            )}
          {d.status === "in_review" &&
            ["owner", "admin"].includes(member.role) && (
              <form action={transitionDraft}>
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="hidden"
                  name="channel"
                  value={d.channel || "linkedin"}
                />
                <input type="hidden" name="revision" value={d.revision} />
                <button className="live-button" name="operation" value="review">
                  Admin review complete
                </button>
                <button
                  className="live-button secondary"
                  name="operation"
                  value="request_changes"
                >
                  Request changes
                </button>
                <small>The author must still give final approval.</small>
              </form>
            )}
          {d.status === "approved" && d.user_id === user.id && (
            <>
              <CopyPost id={d.id} revision={d.revision} />
              {jobs?.find((j) => j.draft_id === d.id) && (
                <form action={cancelScheduled}>
                  <p>
                    Scheduled:{" "}
                    {new Date(
                      jobs.find((j) => j.draft_id === d.id)!.run_at,
                    ).toLocaleString("en-US", { timeZone: org.timezone })}{" "}
                    ({org.timezone})
                  </p>
                  <input type="hidden" name="id" value={d.id} />
                  <input
                    type="hidden"
                    name="channel"
                    value={d.channel || "linkedin"}
                  />
                  <button className="live-button secondary">
                    Cancel schedule
                  </button>
                </form>
              )}
              {d.channel !== "x" && (
                <form action={scheduleLinkedIn}>
                  <input type="hidden" name="id" value={d.id} />
                  <input
                    type="hidden"
                    name="channel"
                    value={d.channel || "linkedin"}
                  />
                  <input type="hidden" name="revision" value={d.revision} />
                  <label>
                    Schedule date and time with timezone offset
                    <input
                      name="publish_at"
                      placeholder="2026-10-01T09:00:00-04:00"
                      required
                    />
                  </label>
                  <small>
                    Publishing runs every 15 minutes when the scheduled job is
                    configured. Editing revokes the scheduled approval.
                  </small>
                  <button className="live-button secondary">
                    Schedule approved post
                  </button>
                </form>
              )}
              <form action={recordManual}>
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="hidden"
                  name="channel"
                  value={d.channel || "linkedin"}
                />
                <input type="hidden" name="revision" value={d.revision} />
                <label>
                  {d.channel === "x" ? "X" : "LinkedIn"} post URL after you
                  publish
                  <input
                    name="url"
                    type="url"
                    placeholder={
                      d.channel === "x"
                        ? "https://x.com/yourname/status/123"
                        : "https://www.linkedin.com/posts/…"
                    }
                    required={d.channel === "x"}
                  />
                </label>
                <label>
                  <input type="checkbox" required />I published this approved
                  text. Without a URL, record it as unverified.
                </label>
                <button className="live-button secondary">
                  Record manual post
                </button>
              </form>
              <form action={publishLinkedIn}>
                <input type="hidden" name="id" value={d.id} />
                <input
                  type="hidden"
                  name="channel"
                  value={d.channel || "linkedin"}
                />
                <input type="hidden" name="revision" value={d.revision} />
                <label>
                  <input name="confirmed" type="checkbox" required />
                  Publish this saved, approved text to my connected{" "}
                  {d.channel === "x" ? "X" : "LinkedIn"} profile now.
                </label>
                <button className="live-button">
                  Publish to {d.channel === "x" ? "X" : "LinkedIn"}
                </button>
              </form>
            </>
          )}
          {d.linkedin_url && (
            <a href={d.linkedin_url} target="_blank" rel="noreferrer">
              View published post ↗
            </a>
          )}
          {d.status === "publish_uncertain" && (
            <p>
              Delivery needs a manual check on your social profile. Automatic
              retries are disabled to prevent duplicate posts.
            </p>
          )}
        </article>
      ))}
    </>
  );
}
