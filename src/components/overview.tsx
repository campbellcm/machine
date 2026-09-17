"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  FileText,
  MousePointer2,
  Users,
  MessageCircle,
  Check,
  ChevronRight,
  Link2,
} from "lucide-react";
import { demoData } from "@/lib/demo/data";
import { summarize, activity, type Period } from "@/lib/demo/metrics";
import { Avatar, PageHeading, PostPreview } from "./shared";
import { Button } from "./ui/button";
export function Overview() {
  const [period, setPeriod] = useState<Period>("month");
  const stats = summarize(demoData, period);
  const bars = activity(demoData, period);
  const max = Math.max(...bars.map((b) => b.count), 1);
  const topPosts = demoData.posts
    .filter((p) => p.status === "published")
    .map((post) => ({
      ...post,
      clicks: demoData.clicks.filter(
        (c) => c.postId === post.id && !c.isBot && !c.isDuplicate,
      ).length,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 3);
  return (
    <>
      <PageHeading
        eyebrow="YOUR TEAM. THEIR VOICE."
        title="Good things start with a story."
        description="Here’s how your team is turning everyday expertise into impact."
      >
        <label className="period-picker">
          <span className="sr-only">Reporting period</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            <option value="month">September 2026</option>
            <option value="all">All sample activity</option>
          </select>
        </label>
      </PageHeading>
      <section className="hero-card" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Sparkles size={15} /> EVERYONE HAS SOMETHING TO SHARE
          </span>
          <h2 id="hero-title">
            Your next great post
            <br />
            is already in your head.
          </h2>
          <p>
            A small lesson. A customer moment. A fresh perspective.
            <br className="desktop-break" /> Give your team a place to start.
          </p>
          <Button asChild>
            <Link href="/demo/ideas">
              Explore conversation starters <ArrowRight size={16} />
            </Link>
          </Button>
          <span className="hero-footnote">
            Your experience. Your voice. Always your approval.
          </span>
        </div>
        <div className="story-visual" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <div className="floating-note note-one">
            <span className="note-icon purple">
              <Sparkles size={16} />
            </span>
            A lesson worth sharing
          </div>
          <div className="story-paper">
            <div className="paper-top">
              <span className="avatar purple">AM</span>
              <div>
                <strong>Alex Morgan</strong>
                <small>Finding the story in the everyday</small>
              </div>
              <span className="linkedin-mark">in</span>
            </div>
            <div className="paper-quote">
              “The best feature
              <br />
              we shipped was
              <br />
              <span>a question.</span>”
            </div>
            <div className="paper-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="paper-footer">
              <span>
                <Check size={12} /> In your own voice
              </span>
              <Sparkles size={15} />
            </div>
          </div>
          <div className="floating-note note-two">
            <span className="note-icon green">
              <MessageCircle size={17} />
            </span>
            Real people. Real perspectives.
          </div>
          <span className="spark spark-one">✦</span>
          <span className="spark spark-two">✦</span>
        </div>
      </section>
      <div className="section-label">
        <h2>Your team at a glance</h2>
        <span>
          Sample activity · {period === "month" ? "This month" : "All time"}
        </span>
      </div>
      <section className="stats-grid" aria-label="Team metrics">
        {[
          {
            label: "Published posts",
            value: stats.posts,
            icon: FileText,
            note: "Stories out in the world",
            color: "blue",
          },
          {
            label: "Unique clicks",
            value: stats.clicks,
            icon: MousePointer2,
            note: "Bots and repeat clicks excluded",
            color: "purple",
          },
          {
            label: "Leads & demo requests",
            value: stats.leads,
            icon: MessageCircle,
            note: "Active sample conversions",
            color: "green",
          },
          {
            label: "Opted-in teammates",
            value: `${stats.optedIn} / 12`,
            icon: Users,
            note: `${stats.participation}% published in this period`,
            color: "orange",
          },
        ].map(({ label, value, icon: Icon, note, color }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <Icon className={`icon-${color}`} size={17} />
            </div>
            <strong>
              {typeof value === "number" ? value.toLocaleString() : value}
            </strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <div className="dashboard-grid">
        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h2>Small stories. Growing connections.</h2>
              <p>Unique clicks across your team’s sample posts</p>
            </div>
            <span className="chart-legend">
              <i /> Clicks
            </span>
          </div>
          <div
            className="chart"
            role="img"
            aria-label={bars
              .map((b) => `${b.label}: ${b.count} clicks`)
              .join("; ")}
          >
            <div className="chart-grid">
              <span>{max}</span>
              <span>{Math.round(max / 2)}</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              {bars.map((b, i) => (
                <div className="chart-column" key={b.label}>
                  <span className="bar-value">{b.count}</span>
                  <div
                    className={`bar ${i === bars.length - 1 ? "bar-last" : ""}`}
                    style={{
                      height: `${Math.max(4, (b.count / max) * 145)}px`,
                    }}
                  />
                  <span className="bar-label">{b.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-footer">
            <span>
              <Link2 size={14} /> Every connection starts with a conversation.
            </span>
            <Link href="/demo/team">
              Meet your team <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className="panel checklist-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">A STRONG START</span>
              <h2>Make room for great stories.</h2>
            </div>
          </div>
          <p className="muted">
            A few simple steps to bring your workspace to life.
          </p>
          <div className="setup-progress">
            <span />
          </div>
          <span className="setup-caption">1 of 3 foundation steps ready</span>
          <Link className="checklist-row" href="/demo/team">
            <span className="check-circle">
              <Check size={14} />
            </span>
            <div>
              <strong>Meet the sample team</strong>
              <small>12 perspectives, one company</small>
            </div>
            <ChevronRight size={15} />
          </Link>
          <Link className="checklist-row" href="/demo/settings">
            <span className="step-circle">2</span>
            <div>
              <strong>Add your company context</strong>
              <small>Coming in the next milestone</small>
            </div>
            <ChevronRight size={15} />
          </Link>
          <Link className="checklist-row" href="/demo/ideas">
            <span className="step-circle">3</span>
            <div>
              <strong>Find your first story</strong>
              <small>Explore conversation starters</small>
            </div>
            <ChevronRight size={15} />
          </Link>
        </section>
      </div>
      <section className="panel recent-posts">
        <div className="panel-heading">
          <div>
            <h2>A little inspiration from the team</h2>
            <p>Popular posts across all sample activity</p>
          </div>
          <Link className="text-link" href="/demo/content">
            View all content <ArrowRight size={15} />
          </Link>
        </div>
        <div className="post-table">
          {topPosts.map((post) => {
            const person = demoData.teammates.find(
              (p) => p.id === post.userId,
            )!;
            return (
              <div className="post-row" key={post.id}>
                <Avatar person={person} />
                <div className="post-row-copy">
                  <PostPreview post={post} />
                  <span>
                    {person.name} <b>·</b> {post.angle}
                  </span>
                </div>
                <span className="click-count">
                  <strong>{post.clicks}</strong> clicks
                </span>
                <PostPreview post={post}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Preview post by ${person.name}`}
                  >
                    <ArrowUpRight size={18} />
                  </Button>
                </PostPreview>
              </div>
            );
          })}
        </div>
      </section>
      <div className="preview-notice">
        <span className="notice-dot" />
        <p>
          You’re exploring a foundation preview. All people, posts, and results
          are fictional.
        </p>
        <Link href="/demo/roadmap">
          What’s next <ArrowRight size={14} />
        </Link>
      </div>
    </>
  );
}
