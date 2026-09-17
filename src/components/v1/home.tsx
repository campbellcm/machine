"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  Eye,
  MousePointer2,
  Users,
  ShoppingBag,
  FileText,
} from "lucide-react";
import { PageHeading } from "@/components/shared";
import { rankPeople, type Report } from "@/lib/v1/report";
const metrics = [
  ["views", "Views / impressions", Eye],
  ["clicks", "Unique clicks", MousePointer2],
  ["leads", "Leads", Users],
  ["sales", "Sales", ShoppingBag],
  ["posts", "Posts", FileText],
] as const;
const format = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("en-US");
export function HomeDashboard({
  report,
  start,
  end,
  demo = false,
  timezone = "UTC",
}: {
  report: Report;
  start: string;
  end: string;
  demo?: boolean;
  timezone?: string;
}) {
  const [channel, setChannel] = useState("all");
  const [sort, setSort] = useState<
    "posts" | "views" | "clicks" | "leads" | "sales"
  >("posts");
  const ranked = rankPeople(report.people, sort);
  const posts = report.posts.filter(
    (p) => channel === "all" || p.channel === channel,
  );
  return (
    <div className="v1">
      <PageHeading
        eyebrow="A little effort. A bigger impact."
        title="Your team, in the spotlight."
        description="One place to see what your people are putting into the world."
      />
      <div className="v1-toolbar">
        <span className="v1-badge">
          {demo ? "Sample workspace · fictional activity" : "Company activity"}
        </span>
        <form className="v1-filters">
          <label>
            From
            <input type="date" name="start" defaultValue={start} required />
          </label>
          <label>
            Through
            <input
              type="date"
              name="end"
              defaultValue={end}
              min={start}
              required
            />
          </label>
          <button className="live-button">Apply dates</button>
        </form>
      </div>
      <div className="v1-stats">
        {metrics.map(([key, label, Icon]) => {
          const available =
            report.people.length > 0 &&
            report.people.every((p) => p[key] !== null);
          const total = available
            ? report.people.reduce((s, p) => s + (p[key] ?? 0), 0)
            : key === "views" || key === "sales"
              ? null
              : 0;
          return (
            <section className="v1-card" key={key}>
              <Icon size={18} />
              <p>{label}</p>
              <strong className="v1-number">{format(total)}</strong>
              <small>
                {total === null
                  ? "Integration required"
                  : demo
                    ? "Illustrative sample data"
                    : "In selected period"}
              </small>
            </section>
          );
        })}
      </div>
      <section className="v1-card">
        <div className="v1-section-title">
          <div>
            <p className="eyebrow">Good work adds up</p>
            <h2>Team leaderboard</h2>
          </div>
          <label>
            Rank by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              {metrics.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="v1-table-wrap" tabIndex={0} role="region" aria-label="Team leaderboard">
          <table className="v1-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Teammate</th>
                {metrics.map(([k, l]) => (
                  <th key={k}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((p) => (
                <tr key={p.id}>
                  <td>{p.rank ?? "—"}</td>
                  <td>
                    <strong>{p.name || "Teammate"}</strong>
                    <small>{p.role}</small>
                  </td>
                  {metrics.map(([k]) => (
                    <td key={k}>{format(p[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranked.length && (
          <p>No team activity yet. Invite your first teammate from Team.</p>
        )}
      </section>
      <div className="v1-section-title">
        <div>
          <p className="eyebrow">Made by your people</p>
          <h2>The team feed</h2>
          <p>{posts.length} posts in this date range</p>
        </div>
        <label>
          Feed channel
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="all">All channels</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
          </select>
        </label>
      </div>
      <div className="v1-grid">
        {posts.map((p) => (
          <article className="v1-card v1-post" key={p.id}>
            <div className="v1-section-title">
              <strong>{p.author || "Teammate"}</strong>
              <span className="v1-channel">
                {p.channel === "x" ? "𝕏" : "in"}
              </span>
            </div>
            <small>
              {new Date(p.date).toLocaleDateString("en-US", {
                timeZone: timezone,
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </small>
            <p>{p.body}</p>
            {p.url &&
              /^https:\/\/(www\.)?(linkedin\.com|x\.com)\//.test(p.url) && (
                <a href={p.url} target="_blank" rel="noreferrer">
                  View post <ArrowUpRight size={14} />
                </a>
              )}
            {demo && <small>Fictional post · preview only</small>}
          </article>
        ))}
      </div>
      {!posts.length && (
        <section className="v1-card">
          <h3>No posts in this view.</h3>
          <p>Try another date range or channel.</p>
        </section>
      )}
      {posts.length >= report.feed_limit && (
        <p>
          Showing the latest {report.feed_limit} posts. Narrow the date range to
          see more.
        </p>
      )}
      <p className="v1-note">
        Dates use {timezone}. Feed dates are publication dates; clicks and leads
        use the date of the event. Views are not unique people across channels.
        A dash means data is unavailable, not zero.
      </p>
    </div>
  );
}
