"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Report } from "@/lib/v1/report";
export function PostDetail({
  post,
  timezone,
}: {
  post: Report["posts"][number];
  timezone: string;
}) {
  const a = post.analytics;
  const samples = a?.history.slice(-12) || [];
  const max = Math.max(1, ...samples.map((p) => p.impressions || 0));
  const date = (value: string) =>
    new Date(value).toLocaleString("en-US", { timeZone: timezone });
  return (
    <Dialog.Root>
      <Dialog.Trigger className="feed-expand">
        Post details<span className="sr-only"> for {post.author}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content post-detail-drawer">
          <div className="dialog-top">
            <span className="eyebrow">
              {post.channel === "x" ? "X" : "LinkedIn"} · {post.author}
            </span>
            <Dialog.Close
              className="icon-button"
              aria-label="Close post details"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Title className="dialog-title">Behind the post</Dialog.Title>
          <Dialog.Description>
            {post.source || "Workspace post"} · Published {date(post.date)} (
            {timezone})
          </Dialog.Description>
          <p className="feed-body">{post.body}</p>
          <div className="live-grid">
            <section>
              <h3>Lifetime impressions</h3>
              <strong>{a?.lifetime?.toLocaleString() ?? "—"}</strong>
              <p>Latest available cumulative total, not unique people.</p>
            </section>
            <section>
              <h3>Observed growth</h3>
              <strong>{a?.growth?.toLocaleString() ?? "—"}</strong>
              <p>
                Change between available snapshots within your selected dates.
                Up to 180 recent observations are loaded; this is not the
                complete period total.
              </p>
            </section>
          </div>
          {a?.from && a.to && (
            <p>
              Observed {date(a.from)} through {date(a.to)}.
            </p>
          )}
          {samples.length > 0 ? (
            <>
              <div
                className="snapshot-chart"
                role="img"
                aria-label="Impression snapshots; exact values in the table below"
              >
                {samples.map((s) => (
                  <span
                    key={s.observed_at}
                    style={{
                      height: `${Math.max(2, ((s.impressions || 0) / max) * 100)}%`,
                    }}
                  />
                ))}
              </div>
              <details>
                <summary>View snapshot values</summary>
                <table className="v1-table">
                  <thead>
                    <tr>
                      <th>Observed ({timezone})</th>
                      <th>Lifetime impressions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {samples.map((s) => (
                      <tr key={s.observed_at}>
                        <td>{date(s.observed_at)}</td>
                        <td>{s.impressions ?? "Unavailable"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p>No supported analytics observations yet.</p>
          )}
          <p>
            Last metric sync: {a?.lastSync ? date(a.lastSync) : "Not available"}
            . Missing data is never counted as zero.
          </p>
          <section>
            <h3>Attributed business activity</h3>
            {post.attribution ? (
              <>
                <p>
                  Campaigns:{" "}
                  {post.attribution.campaigns.join(", ") ||
                    "No campaign linked"}
                </p>
                <p>
                  {post.attribution.clicks} unique tracked clicks ·{" "}
                  {post.attribution.leads} attributed leads (lifetime)
                </p>
              </>
            ) : (
              <p>No tracked-link attribution is available for this post.</p>
            )}
            <p>
              Conversions require a recorded click and a submitted conversion
              within the attribution window. Broader influence is not counted as
              attributed revenue.
            </p>
          </section>
          {post.url &&
            /^https:\/\/(www\.)?(x\.com|linkedin\.com)\//.test(post.url) && (
              <a href={post.url} target="_blank" rel="noreferrer">
                View original post ↗
              </a>
            )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
