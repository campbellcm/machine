"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  ArrowRight,
  FileText,
  Lightbulb,
  Sparkles,
  ShieldCheck,
  Circle,
  Check,
  LockKeyhole,
} from "lucide-react";
import { demoData, type Post } from "@/lib/demo/data";
import { summarize } from "@/lib/demo/metrics";
import { Avatar, PageHeading, PostPreview, Status } from "./shared";
import { Button } from "./ui/button";
import { productName } from "@/lib/config";
export function ContentLibrary() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const posts = demoData.posts.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      p.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="THE CONTENT LIBRARY"
        title="Expertise, in their own words."
        description="Explore the sample team’s stories, lessons, and fresh perspectives."
      />
      <div className="toolbar">
        <div className="tabs" role="group" aria-label="Content status">
          {[
            ["all", "All content"],
            ["draft", "Drafts"],
            ["in_review", "In review"],
            ["published", "Published"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
              <span>
                {
                  demoData.posts.filter(
                    (p) => value === "all" || p.status === value,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search posts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
          />
        </label>
      </div>
      <p className="helper-text">
        Read-only sample content. Real drafts will be private to their author,
        with access rules added in M1–M2.
      </p>
      <div className="content-grid">
        {posts.map((post) => (
          <PostCard post={post} key={post.id} />
        ))}
      </div>
      {posts.length === 0 && (
        <div className="empty-state">
          <Search />
          <h2>No matching stories.</h2>
          <p>Try another search or choose a different status.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setFilter("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </>
  );
}
function PostCard({ post }: { post: Post }) {
  const person = demoData.teammates.find((t) => t.id === post.userId)!;
  return (
    <article className="panel content-card">
      <div className="card-top">
        <Status status={post.status} />
        <span className="muted">
          {new Date(post.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "America/New_York",
          })}
        </span>
      </div>
      <span className="content-angle">{post.angle}</span>
      <h2>{post.title}</h2>
      <p className="content-excerpt">{post.body}</p>
      <div className="content-card-footer">
        <div className="person-line">
          <Avatar person={person} small />
          <strong>{person.name}</strong>
        </div>
        <PostPreview post={post}>
          <Button variant="ghost" size="icon" aria-label={`Read ${post.title}`}>
            <ArrowRight size={18} />
          </Button>
        </PostPreview>
      </div>
    </article>
  );
}
export function Team() {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All departments");
  const people = demoData.teammates.filter(
    (p) =>
      (department === "All departments" || p.department === department) &&
      `${p.name} ${p.title}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE MAKE THE DIFFERENCE"
        title="One team. A dozen perspectives."
        description="Meet the fictional people bringing this demo workspace to life."
      />
      <div className="team-intro">
        <div className="avatar-stack">
          {demoData.teammates.slice(0, 5).map((p) => (
            <Avatar person={p} key={p.id} />
          ))}
        </div>
        <div>
          <strong>10 teammates have opted in</strong>
          <p>Participation is always their choice.</p>
        </div>
        <span className="pill">12 sample teammates</span>
      </div>
      <div className="toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search teammates"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a teammate…"
          />
        </label>
        <label className="period-picker">
          <span className="sr-only">Department</span>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {[
              "All departments",
              ...new Set(demoData.teammates.map((t) => t.department)),
            ].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <section className="panel team-table-wrap">
        <table className="team-table">
          <caption className="sr-only">
            Sample team activity for all time
          </caption>
          <thead>
            <tr>
              <th>Teammate</th>
              <th>Department</th>
              <th>Participation</th>
              <th>Posts</th>
              <th>Unique clicks</th>
              <th>Leads & demos</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const s = summarize(demoData, "all", p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="person-line">
                      <Avatar person={p} />
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.title}</small>
                      </div>
                    </div>
                  </td>
                  <td>{p.department}</td>
                  <td>
                    <span
                      className={`status ${p.optedIn ? "published" : "draft"}`}
                    >
                      <span />
                      {p.optedIn ? "Opted in" : "Not opted in"}
                    </span>
                  </td>
                  <td>{s.posts}</td>
                  <td>{s.clicks}</td>
                  <td>{s.leads}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {people.length === 0 && (
          <div className="empty-state">
            <h2>No teammates found.</h2>
            <p>Try another name or department.</p>
          </div>
        )}
      </section>
      <p className="helper-text">
        Showing {people.length} of 12 fictional teammates · All sample activity
      </p>
    </>
  );
}
const ideas = [
  {
    category: "Behind the scenes",
    title: "The part of your work nobody sees.",
    prompt:
      "What is one small thing your team does that makes a bigger difference than people realize?",
    color: "purple",
  },
  {
    category: "A lesson learned",
    title: "Something you changed your mind about.",
    prompt:
      "What did you once believe about your work that experience taught you to question?",
    color: "blue",
  },
  {
    category: "Customer perspective",
    title: "A conversation that stayed with you.",
    prompt:
      "Without naming the customer, what recent conversation helped you understand a problem differently?",
    color: "green",
  },
  {
    category: "How you work",
    title: "Your most underrated habit.",
    prompt:
      "What simple practice helps you do better work, and how did you discover it?",
    color: "orange",
  },
  {
    category: "An honest moment",
    title: "The lesson behind the mistake.",
    prompt:
      "What went differently than you expected on a recent project, and what will you do differently next time?",
    color: "blue",
  },
  {
    category: "Team spotlight",
    title: "A small win worth celebrating.",
    prompt:
      "What did someone on your team do recently that deserves a little more recognition?",
    color: "purple",
  },
];
export function Ideas() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <>
      <PageHeading
        eyebrow="A SPARK IS ALL IT TAKES"
        title="You have more to say than you think."
        description="Start with a real moment. The best stories are already yours."
      />
      <div className="ideas-banner">
        <Sparkles size={23} />
        <p>
          No trends to chase. No borrowed opinions.
          <br />
          <strong>Just your experience, made easier to share.</strong>
        </p>
      </div>
      <section className="ideas-grid">
        {ideas.map((idea, i) => (
          <article
            className={`panel idea-card ${selected === i ? "idea-selected" : ""}`}
            key={idea.title}
          >
            <span className={`idea-icon ${idea.color}`}>
              <Lightbulb size={22} />
            </span>
            <span className="content-angle">{idea.category}</span>
            <h2>{idea.title}</h2>
            <p>{idea.prompt}</p>
            <Button
              variant="ghost"
              onClick={() => setSelected(selected === i ? null : i)}
              aria-expanded={selected === i}
            >
              {selected === i ? "Close prompt" : "Explore this prompt"}
              <ArrowRight size={16} />
            </Button>
            {selected === i && (
              <div className="idea-expanded">
                <strong>Think of a specific moment.</strong>
                <p>What happened? What surprised you? What did you learn?</p>
                <span>
                  Guided AI interviews arrive in M2. This preview does not
                  collect answers.
                </span>
              </div>
            )}
          </article>
        ))}
      </section>
    </>
  );
}
export function Settings() {
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="A foundation built on trust."
        description="A preview of the setup that will make this space your own."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <span className="idea-icon blue">
            <SettingsIcon />
          </span>
          <h2>Company workspace</h2>
          <dl>
            <div>
              <dt>Company</dt>
              <dd>Acme · Fictional organization</dd>
            </div>
            <div>
              <dt>Timezone</dt>
              <dd>America/New_York</dd>
            </div>
            <div>
              <dt>Product name</dt>
              <dd>{productName}</dd>
            </div>
            <div>
              <dt>Data source</dt>
              <dd>Deterministic sample records</dd>
            </div>
          </dl>
          <p className="helper-text">
            Company editing, brand context, and invitations arrive in M1.
          </p>
        </section>
        <section className="panel settings-card">
          <span className="idea-icon green">
            <ShieldCheck size={23} />
          </span>
          <h2>Trust comes first</h2>
          <ul className="trust-list">
            <li>
              <Check />
              Teammates approve their own posts.
            </li>
            <li>
              <Check />
              Participation is optional.
            </li>
            <li>
              <Check />
              Internal programs stay internal.
            </li>
            <li>
              <Check />
              No social media scraping.
            </li>
          </ul>
          <p className="helper-text">
            These are product commitments. Authentication and database access
            controls are not implemented in this demo.
          </p>
        </section>
      </div>
      <section className="panel connection-section">
        <h2>Connections, when you’re ready.</h2>
        <p className="muted">
          No external services are connected. No secrets are needed to explore
          this foundation.
        </p>
        <div className="connection-grid">
          {[
            ["Company & sign-in", "Supabase", "M1"],
            ["AI interviews", "Anthropic", "M2"],
            ["LinkedIn publishing", "LinkedIn", "M5"],
            ["CRM attribution", "HubSpot / Salesforce", "M6"],
          ].map(([title, provider, milestone]) => (
            <div className="connection-card" key={title}>
              <span className="connection-icon">
                <LockKeyhole size={18} />
              </span>
              <strong>{title}</strong>
              <small>{provider}</small>
              <span className="pill">Planned · {milestone}</span>
            </div>
          ))}
        </div>
        <Link className="text-link" href="/demo/roadmap">
          Explore the build roadmap <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}
function SettingsIcon() {
  return <FileText size={23} />;
}
export function Roadmap() {
  const stages = [
    [
      "M0",
      "The foundation",
      "App shell, design system, fictional seed data, and automated checks.",
      "Local preview",
    ],
    [
      "M1",
      "A space for your company",
      "Sign-in, organizations, roles, invitations, context, and opt-in consent.",
      "Next",
    ],
    [
      "M2",
      "From interview to approved post",
      "A guided interview, three drafts, your approval, and manual publishing.",
      "Planned",
    ],
    [
      "M3",
      "See what your stories start",
      "Trackable links, conversions, and live team reporting.",
      "Planned",
    ],
    [
      "M4",
      "Build a consistent habit",
      "Private challenges, ideas, and weekly reports.",
      "Planned",
    ],
    [
      "M5",
      "Connect LinkedIn",
      "Direct publishing and analytics, subject to platform access.",
      "Planned",
    ],
    [
      "M6",
      "Connect the dots to revenue",
      "HubSpot and Salesforce attribution.",
      "Planned",
    ],
    [
      "M7",
      "Ready for real businesses",
      "Billing, audit logs, monitoring, and security review.",
      "Planned",
    ],
    [
      "M8",
      "Reward workflows",
      "Approvals and payroll exports. No funds are moved by this app.",
      "Planned",
    ],
    [
      "M9",
      "Payroll connection",
      "Unsubmitted payroll drafts, subject to provider approval.",
      "Planned",
    ],
  ];
  return (
    <>
      <PageHeading
        eyebrow="ONE THOUGHTFUL STEP AT A TIME"
        title="From a foundation to a first story."
        description="The product brief is a ten-milestone build. You’re exploring the first."
      />
      <div className="roadmap-note">
        <Sparkles size={22} />
        <div>
          <strong>The first design-partner demo is M2.</strong>
          <p>
            That’s when a teammate can turn an interview into an approved post.
            This milestone establishes the workspace around that experience.
          </p>
        </div>
      </div>
      <section className="roadmap-list">
        {stages.map(([id, title, description, status], i) => (
          <article
            className={`panel roadmap-item ${i === 0 ? "current" : ""}`}
            key={id}
          >
            <span className="milestone-number">{id}</span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <span className="pill">
              {i === 0 ? <Check size={13} /> : <Circle size={10} />} {status}
            </span>
          </article>
        ))}
      </section>
    </>
  );
}
