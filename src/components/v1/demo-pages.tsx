"use client";
import Link from "next/link";
import { useState } from "react";
import { demoData } from "@/lib/demo/data";
import { demoReport, rankPeople } from "@/lib/v1/report";
import { RewardRow } from "./reward-row";
import { TeamAvatar } from "./team-avatar";
import { PageHeading } from "@/components/shared";
export function DemoTeam() {
  const [query, setQuery] = useState("");
  const [person, setPerson] = useState<string | null>(null);
  const report = demoReport("2026-09-01", "2026-09-30");
  const selected = report.people.find((p) => p.id === person);
  return (
    <div className="v1">
      <PageHeading
        eyebrow="Different voices. One team."
        title="Better, together."
        description="See who’s ready to share, and where they’re connected."
      />
      <div className="v1-toolbar">
        <span className="v1-badge">Fictional connection states</span>
        <label>
          Find a teammate
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or role"
          />
        </label>
        <Link href="/setup" className="live-button">
          Set up your real team
        </Link>
      </div>
      <section className="live-card">
        <h2>Program participation</h2>
        <p>
          Sample: {report.people.filter((p) => p.channels?.length).length}{" "}
          connected · {report.people.filter((p) => p.posts > 0).length} shared
          content this month.
        </p>
        <p>
          Offer support with setup and content. Participation is optional, not a
          measure of employee productivity.
        </p>
      </section>
      {selected && (
        <section className="live-card" aria-label="Teammate performance">
          <button
            className="live-button secondary"
            onClick={() => setPerson(null)}
          >
            Close profile
          </button>
          <h2>{selected.name}</h2>
          <p>
            September sample: {selected.posts} posts · {selected.clicks} clicks
            · {selected.leads} leads.
          </p>
          <p>
            Published work only. Private drafts and source notes stay private.
          </p>
          {report.posts
            .filter((p) => p.user_id === selected.id)
            .map((p) => (
              <details key={p.id}>
                <summary>
                  {p.channel === "x" ? "X" : "LinkedIn"} ·{" "}
                  {p.body.slice(0, 100)}…
                </summary>
                <p>{p.body}</p>
              </details>
            ))}
        </section>
      )}
      <div className="team-list" role="list" aria-label="Team members">
        {demoData.teammates
          .filter((p) =>
            (p.name + " " + p.title)
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((p) => (
            <article className="team-row" role="listitem" key={p.id}>
              <div className="team-person">
                <TeamAvatar
                  name={p.name}
                  src={`https://i.pravatar.cc/88?img=${[12, 47, 13, 44, 11, 49, 14, 48, 15, 45, 16, 46][demoData.teammates.indexOf(p)]}`}
                />
                <div>
                  <h3>
                    <button
                      className="live-button secondary"
                      onClick={() => setPerson(p.id)}
                    >
                      {p.name}
                    </button>
                  </h3>
                  <p>{p.title}</p>
                </div>
              </div>
              <div className="team-channel">
                <strong>LinkedIn</strong>
                <small>
                  {demoData.teammates.indexOf(p) < 8
                    ? "Sample profile connected"
                    : "Not connected · sample"}
                </small>
              </div>
              <div className="team-channel">
                <strong>X</strong>
                <small>
                  {demoData.teammates.indexOf(p) % 3 === 0
                    ? "Sample profile connected"
                    : "Not connected · sample"}
                </small>
              </div>
            </article>
          ))}
      </div>
    </div>
  );
}
type Prize = {
  id: string;
  title: string;
  prize: string;
  metric: "views" | "clicks" | "leads" | "posts";
  start: string;
  end: string;
};
export function DemoRewards() {
  const [prizes, setPrizes] = useState<Prize[]>([
    {
      id: "1",
      title: "Make an impression",
      prize: "$1,000",
      metric: "views",
      start: "2026-09-01",
      end: "2026-09-30",
    },
    {
      id: "2",
      title: "Open new doors",
      prize: "MacBook Pro",
      metric: "clicks",
      start: "2026-09-01",
      end: "2026-09-30",
    },
    {
      id: "3",
      title: "Start the conversation",
      prize: "Two days in Miami",
      metric: "leads",
      start: "2026-09-01",
      end: "2026-09-30",
    },
  ]);
  const [show, setShow] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <div className="v1">
      <PageHeading
        eyebrow="A little recognition goes a long way"
        title="Your next big win."
        description="Big rewards for the ideas only you can share. Pick your prize. Make your move."
      />
      <div className="v1-toolbar">
        <span className="v1-badge">
          Sample admin view · changes last until reload
        </span>
        <button className="live-button" onClick={() => setShow(!show)}>
          {show ? "Close form" : "Create sample reward"}
        </button>
      </div>
      {show && (
        <form
          className="v1-card v1-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const start = String(f.get("start")),
              end = String(f.get("end"));
            if (end < start) {
              setNotice("End date must follow the start.");
              return;
            }
            setPrizes([
              ...prizes,
              {
                id: crypto.randomUUID(),
                title: String(f.get("title")),
                prize: String(f.get("prize")),
                metric: f.get("metric") as Prize["metric"],
                start,
                end,
              },
            ]);
            setNotice("Sample reward created for this preview.");
            setShow(false);
          }}
        >
          <h2>Create a reward</h2>
          <label>
            Title
            <input name="title" maxLength={100} required />
          </label>
          <label>
            What’s the prize?
            <input
              name="prize"
              maxLength={500}
              required
              placeholder="Cash, a product, an experience…"
            />
          </label>
          <label>
            Most
            <select name="metric">
              <option value="views">Views / impressions</option>
              <option value="clicks">Unique clicks</option>
              <option value="leads">Leads</option>
              <option value="posts">Posts</option>
            </select>
          </label>
          <div className="v1-filters">
            <label>
              Starts
              <input
                type="date"
                name="start"
                defaultValue="2026-09-01"
                required
              />
            </label>
            <label>
              Ends
              <input
                type="date"
                name="end"
                defaultValue="2026-09-30"
                required
              />
            </label>
          </div>
          <button className="live-button">Save sample reward</button>
        </form>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="rewards-list">
        {prizes.map((p) => {
          const people = rankPeople(
            demoReport(p.start, p.end).people,
            p.metric,
          );
          return (
            <RewardRow
              key={p.id}
              title={p.title}
              prize={p.prize}
              metric={p.metric === "views" ? "impressions" : p.metric}
              dates={`${p.start} — ${p.end}`}
              status="Sample competition"
              demo
              leaders={people.map((l) => ({
                id: l.id,
                name: l.name,
                photo: l.photo_url,
                rank: l.rank,
                score: l[p.metric] ?? 0,
              }))}
              rules="The highest score in the selected period leads this sample competition. Tied scores share a rank. These are illustrative prizes and results, not a live giveaway."
            />
          );
        })}
      </div>
    </div>
  );
}
export function DemoAI() {
  const [provider, setProvider] = useState("OpenAI");
  const [role, setRole] = useState("Product designer");
  const [active, setActive] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [hour, setHour] = useState("09:00");
  return (
    <div className="v1">
      <PageHeading
        eyebrow="Your experience. A daily head start."
        title="Let your ideas do more."
        description="Three post options every day. Your voice, your final say."
      />
      <div className="v1-hero">
        <span className="v1-badge">
          {active ? "Sample routine on" : "Your daily writing partner"}
        </span>
        <h2>
          Show up consistently.
          <br />
          Keep sounding like you.
        </h2>
        <p>
          Choose your AI, tell it what you do, and make room for good ideas.
        </p>
      </div>
      <div className="v1-two">
        <form
          className="v1-card v1-form"
          onSubmit={(e) => {
            e.preventDefault();
            setActive(true);
          }}
        >
          <h2>Your daily drafts</h2>
          <label>
            Writing AI
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option>OpenAI</option>
              <option>Claude</option>
            </select>
          </label>
          <label>
            Your role
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label>
            Daily delivery time
            <input
              type="time"
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              required
            />
          </label>
          <button className="live-button">
            {active ? "Update sample routine" : "Try sample routine"}
          </button>
          <small>
            Preview only. No schedule is created and no AI request is sent.
          </small>
        </form>
        <section className="v1-card">
          <h2>
            {active ? "A little head start, every day." : "Ready when you are."}
          </h2>
          <p>
            {active
              ? `${provider} · ${role} · daily at ${hour}`
              : "Start a sample routine to explore the workflow."}
          </p>
          <button
            className="live-button secondary"
            onClick={() => setGenerated(true)}
          >
            Preview three draft options
          </button>
          {active && (
            <button
              className="live-button secondary"
              onClick={() => setActive(false)}
            >
              Pause sample routine
            </button>
          )}
          <p className="v1-note">
            Real daily generation uses your company’s API setup, approved
            business context, and your role. Personal ChatGPT and Claude
            subscriptions are not connected.
          </p>
          <Link href="/setup">Enable real daily drafts →</Link>
        </section>
      </div>
      {generated && (
        <div className="v1-grid">
          {[
            "Share a lesson",
            "Offer a practical tip",
            "Start a conversation",
          ].map((angle, i) => (
            <section className="v1-card" key={angle}>
              <span className="v1-badge">Option {i + 1} · sample</span>
              <h3>{angle}</h3>
              <textarea
                aria-label={`Sample draft ${i + 1}`}
                defaultValue={demoData.posts[i].body}
              />
              <small>
                Prepared example. Editing here does not publish or save to a
                real account.
              </small>
            </section>
          ))}
        </div>
      )}
      <section className="v1-card" style={{ marginTop: 24 }}>
        <h2>Bring your work into the story.</h2>
        <p>
          Fathom, Slack, and CRM connections will add approved work context.
          They are planned, not connected.
        </p>
        <div className="live-inline">
          {["Fathom", "Slack", "CRM"].map((p) => (
            <span key={p} className="v1-badge">
              {p} · planned
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
