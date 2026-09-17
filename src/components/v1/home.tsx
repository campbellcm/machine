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
import { TeamAvatar } from "./team-avatar";
import { PageHeading } from "@/components/shared";
import { rankPeople, type Report } from "@/lib/v1/report";
function ChannelIcon({ channel }: { channel: "linkedin" | "x" }) {
  const name = channel === "linkedin" ? "LinkedIn" : "X";
  return <span className={`account-icon ${channel}`} role="img" aria-label={name} title={name}>
    {channel === "linkedin" ? <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.4 7.8H2V22h3.4V7.8ZM3.7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM22 13.8c0-4.3-2.3-6.3-5.3-6.3-2.5 0-3.6 1.4-4.2 2.3v-2H9.1V22h3.4v-7.9c0-2.1.4-4.1 3-4.1 2.6 0 2.6 2.4 2.6 4.2V22H22v-8.2Z" /></svg> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l8.2-9.4L.8 2h6.5l4.5 6.8L18.9 2Zm-1.1 18h1.7L6.3 4H4.5l13.3 16Z" /></svg>}
  </span>;
}
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
  const [author, setAuthor] = useState("all");
  const [order, setOrder] = useState("newest");
  const [visible, setVisible] = useState(6);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<
    "posts" | "views" | "clicks" | "leads" | "sales"
  >("posts");
  const ranked = rankPeople(report.people, sort);
  const posts = report.posts.filter(
    (p) => (channel === "all" || p.channel === channel) && (author === "all" || p.user_id === author),
  ).sort((a, b) => (order === "newest" ? -1 : 1) * (Date.parse(a.date) - Date.parse(b.date)) || a.id.localeCompare(b.id));
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
                    <div className="leader-person"><TeamAvatar name={p.name || "Teammate"} src={p.photo_url} /><div>
                    <strong>{p.name || "Teammate"}</strong>
                    <small>{p.role}</small>
                    <span className="account-icons" role="group" aria-label="Connected accounts">{p.channels?.map(channel => <ChannelIcon key={channel} channel={channel} />)}</span>
                    </div></div>
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
        <div className="feed-filters"><label>
          Feed channel
          <select value={channel} onChange={(e) => { setChannel(e.target.value); setVisible(6); }}>
            <option value="all">All channels</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X</option>
          </select>
        </label>
        <label>Teammate<select value={author} onChange={e => { setAuthor(e.target.value); setVisible(6); }}><option value="all">Everyone</option>{Array.from(new Map(report.posts.map(p => [p.user_id, p.author])).entries()).sort((a,b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>Sort posts<select value={order} onChange={e => { setOrder(e.target.value); setVisible(6); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
        </div>
      </div>
      <div className="feed-grid">
        {posts.slice(0, visible).map((p) => (
          <article className="v1-card v1-post" key={p.id}>
            <div className="v1-section-title">
              <div className="feed-author"><TeamAvatar name={p.author || "Teammate"} src={report.people.find(person => person.id === p.user_id)?.photo_url} /><strong>{p.author || "Teammate"}</strong></div>
              <ChannelIcon channel={p.channel} />
            </div>
            <small>
              {new Date(p.date).toLocaleDateString("en-US", {
                timeZone: timezone,
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </small>
            <p id={`post-${p.id}`} className="feed-body">{expanded.has(p.id) || p.body.length <= 180 ? p.body : p.body.slice(0, 180).trimEnd() + "…"}</p>
            {p.body.length > 180 && <button className="feed-expand" aria-expanded={expanded.has(p.id)} aria-controls={`post-${p.id}`} onClick={() => setExpanded(previous => { const next = new Set(previous); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); return next; })}>{expanded.has(p.id) ? "See less" : "See more"}<span className="sr-only"> of {p.author}’s post</span></button>}
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
      {posts.length > visible && <div className="feed-more"><p>Showing {Math.min(visible, posts.length)} of {posts.length} posts</p><button className="live-button secondary" onClick={() => setVisible(n => n + 6)}>Show more posts</button></div>}
      {!posts.length && (
        <section className="v1-card">
          <h3>No posts in this view.</h3>
          <p>Try another date range, teammate, or channel.</p>
        </section>
      )}
      {report.posts.length >= report.feed_limit && (
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
