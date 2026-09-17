"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileText, Pause, ShieldCheck } from "lucide-react";
import {
  defaultProfile,
  reasons,
  type ContentProfile,
  type Strategy,
} from "@/lib/content-engine/domain";
import { contentDemo } from "@/lib/content-engine/demo";
import type { EngineData, EngineDraft } from "@/lib/content-engine/types";
import styles from "./engine.module.css";
type Command = (
  operation: string,
  input?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
const statusNames: Record<string, string> = {
  ready_for_employee: "Ready for review",
  employee_changes_requested: "Changes requested",
  ready_for_review: "With your reviewer",
  approved: "Approved",
  rejected: "Skipped",
  archived: "Archived",
  published: "Published",
};
const employeeTabs = [
  "Today",
  "Drafts",
  "Scheduled",
  "Published",
  "My Profile",
];
const adminTabs = [
  "Overview",
  "People",
  "Content Strategy",
  "Sources",
  "Integrations",
  "Analytics",
  "Settings",
];
export function ContentEngine({
  data,
  demo = false,
}: {
  data: EngineData;
  demo?: boolean;
}) {
  const router = useRouter();
  const [sample, setSample] = useState(data);
  const current = demo ? sample : data;
  const [tab, setTab] = useState("Today"),
    [admin, setAdmin] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [onboard, setOnboard] = useState(false),
    [showSource, setShowSource] = useState(false);
  const pending = current.jobs.some((j) =>
    ["queued", "running"].includes(j.status),
  );
  useEffect(() => {
    if (demo || !pending) return;
    const timer = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(timer);
  }, [demo, pending, router]);
  const command: Command = async (operation, input = {}) => {
    setBusy(true);
    setMessage("");
    try {
      if (demo) {
        let output: Record<string, unknown> = { ok: true };
        setSample((previous) => {
          const next = structuredClone(previous);
          const d = next.drafts.find((d) => d.id === input.id);
          if (operation === "profile")
            next.profile = {
              config: input.config as ContentProfile,
              enrolled: !!input.consent,
              paused: false,
              onboarding_step: Number(input.step),
              preferences: next.profile?.preferences || {},
            };
          else if (operation === "strategy")
            next.strategy = input.config as Strategy;
          else if (operation === "pause" && next.profile)
            next.profile.paused = true;
          else if (operation === "resume" && next.profile)
            next.profile.paused = false;
          else if (operation === "reset_preferences" && next.profile)
            next.profile.preferences = {};
          else if (operation === "delete_profile") {
            next.profile = null;
            next.drafts = [];
            next.ideas = [];
            next.sources = [];
          } else if (operation === "source")
            next.sources.unshift({
              id: crypto.randomUUID(),
              title: String(input.title),
              content: String(input.text),
              visibility: String(input.visibility),
              external_use: String(input.external_use),
              roles: [],
              status: "ready",
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
            });
          else if (operation === "delete_source") {
            next.sources = next.sources.filter((s) => s.id !== input.id);
            next.drafts.forEach((d) => {
              if (d.source_ids.includes(String(input.id))) {
                d.invalidated = true;
                d.state = "archived";
              }
            });
          } else if (operation === "dismiss")
            next.ideas = next.ideas.filter((i) => i.id !== input.id);
          else if (operation === "generate") {
            const original = next.drafts[0] || contentDemo().drafts[0];
            next.drafts.unshift({
              ...structuredClone(original),
              id: crypto.randomUUID(),
              state: "ready_for_employee",
              revision: 1,
            });
          } else if (d) {
            if (operation === "edit") {
              d.body = String(input.body);
              d.revision++;
              d.state = "ready_for_employee";
              d.versions.unshift({ revision: d.revision, body: d.body });
            }
            if (operation === "approve")
              d.state = next.strategy.review ? "ready_for_review" : "approved";
            if (operation === "review") d.state = "ready_for_employee";
            if (operation === "request_changes")
              d.state = "employee_changes_requested";
            if (operation === "reject") d.state = "rejected";
            if (operation === "archive") d.state = "archived";
            if (operation === "export") output = { ok: true, body: d.body };
            if (operation === "published") {
              d.state = "published";
              d.url = String(input.url);
              d.published_at = new Date().toISOString();
            }
            if (operation === "metrics")
              next.metrics.unshift({
                draft_id: d.id,
                metrics: input.metrics as Record<string, number | null>,
                observed_at: new Date().toISOString(),
              });
            if (
              (operation === "more" || operation === "less") &&
              next.profile
            ) {
              const key = d.details.topic || "general";
              next.profile.preferences[key] =
                (next.profile.preferences[key] || 0) +
                (operation === "more" ? 1 : -1);
            }
          }
          return next;
        });
        // Sample export uses the exact visible sample text; it never publishes.
        if (operation === "export")
          output = {
            ok: true,
            body: current.drafts.find((d) => d.id === input.id)?.body,
          };
        setMessage(
          "Sample updated for this preview. No AI request or publication was sent.",
        );
        return output;
      }
      const response = await fetch("/workspace/ai/engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, input }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setMessage(
        ["generate", "ideas", "source", "retry"].includes(operation)
          ? "Added to your preparation queue. This page checks for updates automatically."
          : operation === "approve"
            ? "Your review was saved. Nothing has been published."
            : operation === "published"
              ? "Publication recorded as reported by you."
              : "Saved.",
      );
      router.refresh();
      return result;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save. Try again.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  };
  const nav = admin ? adminTabs : employeeTabs;
  const draft = current.drafts.find(
    (d) =>
      d.is_owner &&
      [
        "ready_for_employee",
        "employee_changes_requested",
        "approved",
        "ready_for_review",
      ].includes(d.state),
  );
  const enabled = current.profile?.enrolled;
  return (
    <div className={styles.root} aria-busy={busy}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Your experience. A daily head start.</p>
          <h1>Let your ideas do more.</h1>
          <p>Thoughtful posts. Your voice. Your final say.</p>
        </div>
        {current.admin && (
          <button
            onClick={() => {
              setAdmin(!admin);
              setTab(admin ? "Today" : "Overview");
            }}
          >
            {admin ? "My content" : "AI administration"}
          </button>
        )}
      </header>
      {demo && (
        <div className={styles.sample}>
          <span>
            Interactive sample · fictional content · changes reset on reload
          </span>
          <label>
            Preview as
            <select
              onChange={(e) => {
                setSample(
                  contentDemo(e.target.value as "marketing" | "engineering"),
                );
                setTab("Today");
                setAdmin(false);
                setOnboard(false);
              }}
              defaultValue="marketing"
            >
              <option value="marketing">Marketing manager</option>
              <option value="engineering">Engineering manager</option>
            </select>
          </label>
        </div>
      )}
      <nav className={styles.tabs} aria-label="AI navigation">
        {nav.map((name) => (
          <button
            key={name}
            aria-current={tab === name ? "page" : undefined}
            onClick={() => {
              setTab(name);
              setOnboard(false);
            }}
          >
            {name}
          </button>
        ))}
      </nav>
      {message && (
        <p role="status" className={styles.notice}>
          {message}
        </p>
      )}
      {current.setupError && (
        <div role="alert" className={styles.panel}>
          <h2>Finish the content setup.</h2>
          <p>
            Apply database migration 014, then refresh this page. Your existing
            workspace is unchanged.
          </p>
        </div>
      )}
      {!current.strategy.enabled && (
        <p className={styles.notice}>
          Content preparation is not enabled for this company yet.{" "}
          {current.admin
            ? "Enable it in AI administration → Content Strategy."
            : "Ask your administrator to enable it."}
        </p>
      )}
      {!admin && (!enabled || onboard) ? (
        <Onboarding
          enrolled={!!enabled}
          profile={current.profile?.config || defaultProfile}
          step={current.profile?.onboarding_step || 0}
          command={command}
          busy={busy}
          onDone={() => {
            setOnboard(false);
            setTab("Today");
          }}
        />
      ) : !admin ? (
        <>
          {tab === "Today" && (
            <>
              <div className={styles.todayHeading}>
                <div>
                  <h2>
                    {current.profile?.paused
                      ? "Your content is paused."
                      : "Today’s post"}
                  </h2>
                  <p>
                    {current.profile?.paused
                      ? "Resume when you’re ready for fresh ideas."
                      : "A little head start. A post that’s yours to shape."}
                  </p>
                </div>
                <button onClick={() => setShowSource(!showSource)}>
                  Share an idea
                </button>
              </div>
              {showSource && (
                <SourceForm command={command} admin={false} busy={busy} />
              )}
              {current.profile?.paused ? (
                <div className={styles.empty}>
                  <Pause />
                  <h3>Take the time you need.</h3>
                  <button
                    className={styles.primary}
                    onClick={() => command("resume")}
                  >
                    Resume content
                  </button>
                </div>
              ) : draft ? (
                <DraftCard
                  key={draft.id + draft.revision}
                  draft={draft}
                  data={current}
                  command={command}
                  busy={busy}
                  demo={demo}
                />
              ) : (
                <div className={styles.empty}>
                  <FileText />
                  <h3>
                    {pending
                      ? "Your next post is being prepared."
                      : "Your next good idea starts here."}
                  </h3>
                  <p>
                    {pending
                      ? "We’ll keep your ready posts here. You can leave this page and come back later."
                      : "Add approved context, find a relevant idea, then prepare a draft."}
                  </p>
                  <button
                    className={styles.primary}
                    onClick={() => setShowSource(true)}
                  >
                    Share an idea
                  </button>
                </div>
              )}
              <section className={styles.section}>
                <div className={styles.row}>
                  <div>
                    <h2>Something worth sharing</h2>
                    <p>Ideas grounded in material you’re allowed to use.</p>
                  </div>
                  <button
                    disabled={busy || !current.ready}
                    onClick={() => command("ideas")}
                  >
                    Find ideas
                  </button>
                </div>
                {current.ideas
                  .filter((i) => i.status !== "dismissed")
                  .map((i) => (
                    <article className={styles.idea} key={i.id}>
                      <div>
                        <h3>{i.title}</h3>
                        <p>{i.rationale}</p>
                      </div>
                      <div className={styles.actions}>
                        <button
                          className={styles.primary}
                          disabled={busy || !current.ready}
                          onClick={() =>
                            command("generate", {
                              id: i.id,
                              key: crypto.randomUUID(),
                            })
                          }
                        >
                          Prepare a post
                        </button>
                        <button
                          onClick={() => command("dismiss", { id: i.id })}
                        >
                          Not for me
                        </button>
                      </div>
                    </article>
                  ))}
                {!current.ideas.length && (
                  <p>
                    No suggestions yet. After a source is ready, choose Find
                    ideas.
                  </p>
                )}
              </section>
              {!current.ready && (
                <p className={styles.notice}>
                  Your administrator needs to finish AI service setup before
                  posts can be prepared. You can still set your preferences and
                  add approved notes.
                </p>
              )}
              {current.jobs.length > 0 && (
                <details className={styles.section}>
                  <summary>Preparation status</summary>
                  {current.jobs.map((j) => (
                    <div className={styles.idea} key={j.id}>
                      <span>
                        {new Date(j.created_at).toLocaleDateString()} ·{" "}
                        {j.status === "completed"
                          ? "Ready"
                          : j.status === "failed"
                            ? "Needs attention"
                            : j.status === "canceled"
                              ? "Canceled"
                              : "Preparing"}
                        {j.error_code === "provider_unavailable"
                          ? " · Ask your administrator to finish setup"
                          : ""}
                      </span>
                      {j.status === "failed" && j.attempts < 3 && (
                        <button onClick={() => command("retry", { id: j.id })}>
                          Try again
                        </button>
                      )}
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          {tab === "Drafts" && (
            <DraftList
              data={current}
              command={command}
              busy={busy}
              demo={demo}
            />
          )}
          {tab === "Scheduled" && (
            <div className={styles.empty}>
              <h2>Your publishing stays in your hands.</h2>
              <p>
                For these source-backed posts, approve the text, then copy or
                export it to your social account. Automatic publishing and
                scheduling are not enabled here.
              </p>
              <button onClick={() => setTab("Drafts")}>
                Review your drafts
              </button>
            </div>
          )}
          {tab === "Published" && (
            <>
              <h2>Your published posts</h2>
              <p>
                Manually recorded posts and results. These numbers are
                self-reported, not synced or verified attribution.
              </p>
              {current.drafts
                .filter((d) => d.is_owner && d.state === "published")
                .map((d) => (
                  <DraftCard
                    key={d.id + d.revision}
                    draft={d}
                    data={current}
                    command={command}
                    busy={busy}
                    demo={demo}
                  />
                ))}
              {!current.drafts.some(
                (d) => d.is_owner && d.state === "published",
              ) && (
                <div className={styles.empty}>
                  No published posts recorded yet.
                </div>
              )}
            </>
          )}
          {tab === "My Profile" && (
            <ProfileSettings
              data={current}
              command={command}
              busy={busy}
              onOnboard={() => setOnboard(true)}
            />
          )}
        </>
      ) : (
        <AdminView
          tab={tab}
          data={current}
          command={command}
          busy={busy}
          demo={demo}
        />
      )}
    </div>
  );
}
function Onboarding({
  profile,
  step,
  command,
  busy,
  onDone,
  enrolled,
}: {
  enrolled: boolean;
  profile: ContentProfile;
  step: number;
  command: Command;
  busy: boolean;
  onDone: () => void;
}) {
  const [p, setP] = useState(profile),
    [position, setPosition] = useState(Math.min(step, 5)),
    [consent, setConsent] = useState(false);
  const titles = [
    "What would you like your content to accomplish?",
    "What would you like to be known for?",
    "How should your posts sound?",
    "How often would you like a post?",
    "Where should your posts arrive?",
    "Where would you like to publish?",
  ];
  const set = (key: keyof ContentProfile, value: unknown) =>
    setP({ ...p, [key]: value });
  return (
    <section className={styles.onboarding}>
      <p className={styles.eyebrow}>
        Your content, your choice · Step {position + 1} of 6
      </p>
      <h2>{titles[position]}</h2>
      <p>
        Nothing is published without your permission. You can pause or delete
        your content profile at any time.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const result = await command("profile", {
            config: p,
            consent: enrolled || (position === 5 && consent),
            step: position + 1,
          });
          if (result) {
            if (position === 5) onDone();
            else setPosition(position + 1);
          }
        }}
      >
        {position === 0 && (
          <>
            <label>
              Your role
              <input
                required
                value={p.role}
                onChange={(e) => set("role", e.target.value)}
              />
            </label>
            <Choices
              label="Content goals"
              values={[
                "Build my professional reputation",
                "Educate potential customers",
                "Recruit great people",
                "Share what our company is building",
                "Become known for my expertise",
              ]}
              selected={p.goals}
              change={(v) => set("goals", v)}
            />
          </>
        )}
        {position === 1 && (
          <>
            <label>
              Topics, separated by commas
              <textarea
                required
                value={p.topics.join(", ")}
                onChange={(e) =>
                  set(
                    "topics",
                    e.target.value.split(",").map((t) => t.trim()),
                  )
                }
              />
            </label>
            <label>
              Who would you like to reach?
              <input
                value={p.audience}
                onChange={(e) => set("audience", e.target.value)}
              />
            </label>
          </>
        )}
        {position === 2 && (
          <>
            <Choices
              label="Your voice"
              values={[
                "Concise and direct",
                "Educational",
                "Conversational",
                "Thoughtful",
                "Opinionated",
                "Technical",
                "Executive-level",
                "Lightly humorous",
              ]}
              selected={p.voice}
              change={(v) => set("voice", v)}
            />
            <label>
              Examples of your writing (optional)
              <textarea
                value={p.examples}
                onChange={(e) => set("examples", e.target.value)}
                maxLength={6000}
              />
            </label>
            <label>
              Styles or topics to avoid
              <input
                value={p.avoid}
                onChange={(e) => set("avoid", e.target.value)}
              />
            </label>
          </>
        )}
        {position === 3 && (
          <>
            <label>
              Post frequency
              <select
                value={p.cadence}
                onChange={(e) => set("cadence", e.target.value)}
              >
                <option value="weekdays">Every weekday</option>
                <option value="three">Monday, Wednesday, Friday</option>
                <option value="weekly">Once a week · Monday</option>
                <option value="manual">Let me choose later</option>
              </select>
            </label>
            <label>
              Preferred hour
              <select
                value={p.hour}
                onChange={(e) => set("hour", Number(e.target.value))}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </label>
            <label>
              Timezone
              <input
                required
                value={p.timezone}
                onChange={(e) => set("timezone", e.target.value)}
              />
            </label>
          </>
        )}
        {position === 4 && (
          <>
            <div className={styles.choice}>
              <Check size={18} />
              Inside the app · ready to use
            </div>
            <p>
              Slack, email delivery and mobile notifications need additional
              integration work. We won’t promise delivery through a channel that
              isn’t connected.
            </p>
          </>
        )}
        {position === 5 && (
          <>
            <label>
              Default destination
              <select
                value={p.platform}
                onChange={(e) => set("platform", e.target.value)}
              >
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </select>
            </label>
            <p>
              You can review, copy and export without connecting an account.
              Approval does not publish.
            </p>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              I opt in and permit my approved sources, role and writing
              preferences to be sent to the company’s AI provider to prepare
              posts.
            </label>
          </>
        )}
        <div className={styles.actions}>
          {position > 0 && (
            <button type="button" onClick={() => setPosition(position - 1)}>
              Back
            </button>
          )}
          <button className={styles.primary} disabled={busy}>
            {position === 5 ? "Finish setup" : "Save & continue"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </section>
  );
}
function Choices({
  label,
  values,
  selected,
  change,
}: {
  label: string;
  values: string[];
  selected: string[];
  change: (v: string[]) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className={styles.choices}>
        {values.map((v) => (
          <label className={styles.choice} key={v}>
            <input
              type="checkbox"
              checked={selected.includes(v)}
              onChange={(e) =>
                change(
                  e.target.checked
                    ? [...selected, v]
                    : selected.filter((s) => s !== v),
                )
              }
            />
            {v}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
function DraftList({
  data,
  command,
  busy,
  demo,
}: {
  data: EngineData;
  command: Command;
  busy: boolean;
  demo: boolean;
}) {
  const [filter, setFilter] = useState("ready_for_employee");
  const drafts = data.drafts.filter(
    (d) => d.is_owner && (filter === "all" || d.state === filter),
  );
  return (
    <>
      <div className={styles.row}>
        <h2>Your drafts</h2>
        <label>
          Show drafts
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ready_for_employee">Needs review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Skipped</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      {drafts.map((d) => (
        <DraftCard
          key={d.id + d.revision}
          draft={d}
          data={data}
          command={command}
          busy={busy}
          demo={demo}
        />
      ))}
      {!drafts.length && (
        <div className={styles.empty}>No posts in this view yet.</div>
      )}
    </>
  );
}
function DraftCard({
  draft: d,
  data,
  command,
  busy,
  demo,
}: {
  draft: EngineDraft;
  data: EngineData;
  command: Command;
  busy: boolean;
  demo: boolean;
}) {
  const [editing, setEditing] = useState(false),
    [body, setBody] = useState(d.body),
    [confirm, setConfirm] = useState(false),
    [risk, setRisk] = useState(false),
    [skipping, setSkipping] = useState(false),
    [reason, setReason] = useState(reasons[0]),
    [instruction, setInstruction] = useState(""),
    [copyState, setCopyState] = useState("");
  const account = data.connections.find((c) => c.channel === d.channel);
  const args = { id: d.id, revision: d.revision };
  async function exportPost(download = false) {
    const result = await command("export", args);
    if (!result?.body) return;
    try {
      if (download) {
        const url = URL.createObjectURL(
          new Blob([String(result.body)], { type: "text/plain" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "my-post.txt";
        a.click();
        URL.revokeObjectURL(url);
        setCopyState("Exported. This has not been published.");
      } else {
        await navigator.clipboard.writeText(String(result.body));
        setCopyState("Copied. This has not been published.");
      }
    } catch {
      setCopyState("Copy was unavailable. Use Export instead.");
    }
  }
  return (
    <article className={styles.post}>
      <div className={styles.row}>
        <span className={styles.badge}>
          {d.channel === "x" ? "X" : "LinkedIn"} ·{" "}
          {account
            ? account.name + (account.expired ? " · Reconnect required" : "")
            : "Copy/export destination"}
        </span>
        <span>{statusNames[d.state] || "Needs attention"}</span>
      </div>
      {d.invalidated && (
        <p role="alert">
          The source was removed or is no longer available. Prepare a new post
          from current sources.
        </p>
      )}
      {editing ? (
        <>
          <label>
            Post text
            <textarea
              className={styles.editor}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={d.channel === "x" ? 280 : 3000}
            />
          </label>
          <small>
            {[...body].length} / {d.channel === "x" ? 280 : 3000} characters
          </small>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={busy}
              onClick={async () => {
                if (await command("edit", { ...args, body })) setEditing(false);
              }}
            >
              Save changes
            </button>
            <button
              onClick={() => {
                setBody(d.body);
                setEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className={styles.postText}>{d.body}</p>
      )}
      {!!d.details.riskFlags?.length && (
        <div className={styles.warning}>
          <strong>Check this before sharing</strong>
          <ul>
            {d.details.riskFlags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <details className={styles.why}>
        <summary>Why this post?</summary>
        <p>{d.details.rationale}</p>
        <p>
          For {d.details.audience} · {d.details.objective}
        </p>
        {d.source_ids.map((id) => {
          const s = data.sources.find((s) => s.id === id);
          return (
            <details key={id}>
              <summary>{s?.title || "Source no longer available"}</summary>
              {s && <p>{s.content}</p>}
            </details>
          );
        })}
        {!!d.details.claimChecks?.length && (
          <ul>
            {d.details.claimChecks.map((c, i) => (
              <li key={i}>
                {c.claim} ·{" "}
                {c.supported
                  ? "Evidence supplied—verify before sharing"
                  : "Needs confirmation"}
              </li>
            ))}
          </ul>
        )}
      </details>
      {d.state !== "published" && d.state !== "archived" && !d.invalidated && (
        <>
          {d.state === "approved" ? (
            <div className={styles.actions}>
              <button className={styles.primary} onClick={() => exportPost()}>
                Copy approved post
              </button>
              <button onClick={() => exportPost(true)}>Export</button>
              <button onClick={() => setEditing(true)}>Edit</button>
            </div>
          ) : (
            <div className={styles.actions}>
              <button
                className={styles.primary}
                disabled={busy || d.state === "ready_for_review"}
                onClick={() => setConfirm(!confirm)}
              >
                Approve post
              </button>
              <button onClick={() => setEditing(true)}>Edit</button>
              <button onClick={() => setSkipping(!skipping)}>Skip</button>
            </div>
          )}
          {confirm && (
            <div className={styles.confirm}>
              <h3>Approve for {d.channel === "x" ? "X" : "LinkedIn"}</h3>
              <p>
                This approves the saved text for copy/export. It will not
                publish or schedule a post. A company review may still be
                required.
              </p>
              {!!d.details.riskFlags?.length && (
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={risk}
                    onChange={(e) => setRisk(e.target.checked)}
                  />
                  I checked the flagged claims against approved evidence.
                </label>
              )}
              <button
                className={styles.primary}
                disabled={busy || (!!d.details.riskFlags?.length && !risk)}
                onClick={async () => {
                  if (
                    await command("approve", {
                      ...args,
                      confirmed: true,
                      risk_confirmed: risk,
                    })
                  )
                    setConfirm(false);
                }}
              >
                Confirm approval
              </button>
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
          {skipping && (
            <div className={styles.confirm}>
              <label>
                Why skip this post?
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  {reasons.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <button onClick={() => command("reject", { ...args, reason })}>
                Skip with feedback
              </button>
            </div>
          )}
          <details className={styles.why}>
            <summary>Try another version</summary>
            <label>
              Tell us what to change
              <select
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              >
                <option value="">Same idea, different version</option>
                <option>Make it shorter</option>
                <option>Make it more conversational</option>
                <option>Make it less promotional</option>
                <option>Try a different angle</option>
              </select>
            </label>
            <label>
              Additional direction
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                maxLength={500}
              />
            </label>
            <button
              disabled={busy || !data.ready || !d.opportunity_id}
              onClick={() =>
                command("generate", {
                  id: d.opportunity_id,
                  key: crypto.randomUUID(),
                  instruction,
                })
              }
            >
              Prepare another option
            </button>
            <p>
              Your previous version stays available.
              {demo ? " This creates another sample, not an AI rewrite." : ""}
            </p>
          </details>
        </>
      )}
      <div className={styles.actions}>
        <button onClick={() => command("more", args)}>More like this</button>
        <button onClick={() => command("less", args)}>Less like this</button>
        {d.state !== "published" && (
          <button onClick={() => command("archive", args)}>Archive</button>
        )}
      </div>
      {copyState && <p role="status">{copyState}</p>}
      {d.state === "approved" && (
        <details className={styles.why}>
          <summary>Already posted it?</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              command("published", {
                ...args,
                url: f.get("url"),
                confirmed: true,
              });
            }}
          >
            <label>
              Published post URL
              <input
                type="url"
                name="url"
                required
                placeholder={
                  d.channel === "x"
                    ? "https://x.com/yourname/status/…"
                    : "https://www.linkedin.com/posts/…"
                }
              />
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" required />I published this exact text to
              my account myself.
            </label>
            <button>Record publication</button>
          </form>
        </details>
      )}
      {d.state === "published" && (
        <>
          <p>
            Recorded{" "}
            {d.published_at
              ? new Date(d.published_at).toLocaleDateString()
              : ""}{" "}
            · Self-reported publication
          </p>
          {d.url &&
            /^https:\/\/(www\.)?(linkedin\.com|x\.com)\//.test(d.url) && (
              <a href={d.url} target="_blank" rel="noreferrer">
                View on platform ↗
              </a>
            )}
          <details className={styles.why}>
            <summary>Add performance results</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                command("metrics", { ...args, metrics: Object.fromEntries(f) });
              }}
            >
              <div className={styles.formGrid}>
                {[
                  "impressions",
                  "reactions",
                  "comments",
                  "shares",
                  "clicks",
                  "leads",
                  "meetings",
                  "opportunities",
                  "revenue",
                ].map((metric) => (
                  <label key={metric}>
                    {metric}
                    <input
                      name={metric}
                      type="number"
                      min="0"
                      step={metric === "revenue" ? "0.01" : "1"}
                    />
                  </label>
                ))}
              </div>
              <p>
                Manually entered observations; revenue is correlation, not
                verified attribution.
              </p>
              <button>Save results</button>
            </form>
          </details>
          {data.metrics
            .filter((m) => m.draft_id === d.id)
            .slice(0, 1)
            .map((m) => (
              <p key={m.observed_at}>
                Latest manual results:{" "}
                {Object.entries(m.metrics)
                  .filter(([, v]) => v != null)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")}
              </p>
            ))}
        </>
      )}
      <details className={styles.why}>
        <summary>Version history</summary>
        {d.versions.map((v) => (
          <details key={v.revision}>
            <summary>Version {v.revision}</summary>
            <p className={styles.postText}>{v.body}</p>
          </details>
        ))}
      </details>
      <p className={styles.trust}>
        <ShieldCheck size={15} />
        Nothing is published without your permission.
      </p>
    </article>
  );
}

function SourceForm({
  command,
  admin,
  busy,
  people = [],
}: {
  command: Command;
  admin: boolean;
  busy: boolean;
  people?: { id: string; name: string }[];
}) {
  return (
    <form
      className={styles.panel}
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        if (
          await command("source", {
            title: f.get("title"),
            text: f.get("text"),
            visibility: f.get("visibility") || "private",
            external_use: f.get("external_use"),
            roles: String(f.get("roles") || "")
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            allowed_users: f.getAll("allowed_users"),
            consent: true,
          })
        )
          form.reset();
      }}
    >
      <h3>Add approved context</h3>
      <p>
        Share a lesson, product update, or anonymized call note. Remove customer
        names and confidential details first. Common contact details and secrets
        are automatically removed; review the saved source too.
      </p>
      <label>
        Title
        <input name="title" required minLength={3} maxLength={160} />
      </label>
      <label>
        Approved notes
        <textarea
          name="text"
          required
          minLength={30}
          maxLength={16000}
          rows={6}
        />
      </label>
      <label>
        Allowed use
        <select name="external_use" defaultValue="inspiration_only">
          <option value="inspiration_only">
            Inspiration only — no factual claims or quotes
          </option>
          <option value="approved_fact">Approved facts may be used</option>
          <option value="approved_quote">
            Approved facts and quotes may be used
          </option>
          <option value="internal_only">
            Keep as context only — exclude from AI
          </option>
        </select>
      </label>
      {admin && (
        <>
          <label>
            Who can use this?
            <select name="visibility">
              <option value="private">Only me</option>
              <option value="organization">Selected team members</option>
            </select>
          </label>
          <label>
            Relevant roles, separated by commas
            <input
              name="roles"
              placeholder="Used for topic relevance, not access"
            />
          </label>
          <fieldset className={styles.choices}>
            <legend>
              Team members allowed to use shared material (leave empty for
              everyone enrolled)
            </legend>
            {people.map((p) => (
              <label className={styles.checkbox} key={p.id}>
                <input type="checkbox" name="allowed_users" value={p.id} />
                {p.name}
              </label>
            ))}
          </fieldset>
        </>
      )}
      <label className={styles.checkbox}>
        <input type="checkbox" required />I have permission to use this material
        for this purpose and have removed confidential information.
      </label>
      <p>
        Sources expire after 90 days. Removing a source withdraws approval from
        affected drafts.
      </p>
      <button className={styles.primary} disabled={busy}>
        Save source
      </button>
    </form>
  );
}
function ProfileSettings({
  data,
  command,
  busy,
  onOnboard,
}: {
  data: EngineData;
  command: Command;
  busy: boolean;
  onOnboard: () => void;
}) {
  const p = data.profile;
  const [confirm, setConfirm] = useState("");
  return (
    <section className={styles.panel}>
      <h2>Your content identity</h2>
      <p>
        {p?.config.role} · {p?.config.platform === "x" ? "X" : "LinkedIn"}
      </p>
      <p>{p?.config.topics.join(" · ")}</p>
      <p>{p?.config.voice.join(" · ")}</p>
      <p>
        Preparation: {p?.config.cadence} at {p?.config.hour}:00 (
        {p?.config.timezone}). Delivered inside the app.
      </p>
      <div className={styles.actions}>
        <button onClick={onOnboard}>Edit preferences</button>
        <button
          disabled={busy}
          onClick={() => command(p?.paused ? "resume" : "pause")}
        >
          {p?.paused ? "Resume" : "Pause"} preparation
        </button>
      </div>
      <details className={styles.why}>
        <summary>Your feedback and privacy</summary>
        <p>
          More / less feedback changes which topics are suggested. It never
          trains a shared employee profile.
        </p>
        <p>
          {Object.keys(p?.preferences || {}).length} topic preferences saved.
        </p>
        <button onClick={() => command("reset_preferences")}>
          Reset learned preferences
        </button>
        <p>
          Deleting your content profile removes your content-engine drafts,
          personal sources, jobs and feedback. Your membership and social
          accounts remain.
        </p>
        <label>
          Type DELETE to opt out and remove your content data
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button
          disabled={busy || confirm !== "DELETE"}
          onClick={() => command("delete_profile", { confirm })}
        >
          Delete my content profile
        </button>
      </details>
    </section>
  );
}
function AdminView({
  tab,
  data,
  command,
  busy,
}: {
  tab: string;
  data: EngineData;
  command: Command;
  busy: boolean;
  demo: boolean;
}) {
  const [strategy, setStrategy] = useState(data.strategy);
  const report = data.adminReport;
  const review = data.drafts.filter((d) => d.state === "ready_for_review");
  if (tab === "Content Strategy" || tab === "Settings")
    return (
      <form
        className={styles.panel}
        onSubmit={(e) => {
          e.preventDefault();
          command("strategy", { config: strategy });
        }}
      >
        <h2>
          {tab === "Settings"
            ? "Content controls"
            : "Give your team a shared direction."}
        </h2>
        <p>
          Changes apply to future preparation and require existing approvals to
          be reviewed again.
        </p>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={strategy.enabled}
            onChange={(e) =>
              setStrategy({ ...strategy, enabled: e.target.checked })
            }
          />
          Enable the opt-in content engine
        </label>
        {tab === "Content Strategy" &&
          (
            [
              ["description", "What does your company do?"],
              ["products", "Products and services"],
              ["audiences", "Target audiences"],
              ["goals", "Business goals"],
              ["positioning", "Positioning"],
              ["topics", "Priority topics"],
              ["campaigns", "Current campaigns"],
              [
                "claims",
                "Claims guidance — add supporting facts as approved sources",
              ],
              ["avoid", "Prohibited topics and phrases"],
              ["disclaimer", "Additional disclosure"],
              ["roles", "Role-specific guidance"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                value={strategy[key]}
                maxLength={
                  key === "roles" ? 4000 : key === "disclaimer" ? 250 : 2000
                }
                onChange={(e) =>
                  setStrategy({ ...strategy, [key]: e.target.value })
                }
              />
            </label>
          ))}
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={strategy.review}
            onChange={(e) =>
              setStrategy({ ...strategy, review: e.target.checked })
            }
          />
          Require company review before an employee’s final approval
        </label>
        <div className={styles.formGrid}>
          {(
            [
              ["employee_limit", "Daily generations per person", 10],
              ["daily_limit", "Daily company jobs", 200],
              ["monthly_limit", "Monthly company jobs", 3000],
            ] as const
          ).map(([key, label, max]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                required
                min={1}
                max={max}
                value={strategy[key]}
                onChange={(e) =>
                  setStrategy({ ...strategy, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
        <p>
          Each generation prepares three options. Limits count attempts,
          including failed preparations.
        </p>
        <button className={styles.primary} disabled={busy}>
          Save controls
        </button>
      </form>
    );
  if (tab === "People")
    return (
      <section className={styles.panel}>
        <h2>Participation is a choice.</h2>
        <p>
          Employees own their drafts and preferences. Administrators see
          participation status, not private source notes.
        </p>
        {report?.people.map((p) => (
          <div className={styles.idea} key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p>{p.role}</p>
            </div>
            <span>
              {p.enrolled ? (p.paused ? "Paused" : "Opted in") : "Not enrolled"}{" "}
              · {p.cadence || "No schedule"}
            </span>
          </div>
        ))}
      </section>
    );
  if (tab === "Sources")
    return (
      <>
        <SourceForm
          command={command}
          admin
          busy={busy}
          people={report?.people || []}
        />
        <section className={styles.panel}>
          <h2>Sources available to you</h2>
          {data.sources.map((s) => (
            <details className={styles.why} key={s.id}>
              <summary>
                {s.title} · {s.status}
              </summary>
              <p>
                {s.visibility} · {s.external_use.replaceAll("_", " ")} · expires{" "}
                {new Date(s.expires_at).toLocaleDateString()}
              </p>
              <p className={styles.postText}>{s.content}</p>
              <button
                disabled={busy}
                onClick={() => command("delete_source", { id: s.id })}
              >
                Remove source and withdraw draft approvals
              </button>
            </details>
          ))}
          {!data.sources.length && <p>Add your first approved source above.</p>}
        </section>
      </>
    );
  if (tab === "Integrations")
    return (
      <section className={styles.panel}>
        <h2>Connected context</h2>
        <div className={styles.idea}>
          <div>
            <strong>Manual notes and approved transcripts</strong>
            <p>Paste material you have permission to use.</p>
          </div>
          <span>Available</span>
        </div>
        <div className={styles.idea}>
          <div>
            <strong>OpenAI content preparation</strong>
            <p>
              Uses the company’s API service. Personal ChatGPT or Claude account
              sign-in is not supported.
            </p>
          </div>
          <span>{data.ready ? "Configured" : "Setup required"}</span>
        </div>
        {[
          "Slack",
          "CRM",
          "Fathom, Granola, Fireflies, Circleback, Read AI, Otter, Zoom and Avoma",
          "Email and mobile delivery",
        ].map((name) => (
          <div key={name} className={styles.idea}>
            <div>
              <strong>{name}</strong>
              <p>Not connected to this content workflow yet.</p>
            </div>
            <span>Planned</span>
          </div>
        ))}
        <h3>Publishing</h3>
        <p>
          LinkedIn and X posts can be copied or exported after approval.
          Publishing and metric sync are not automated by this workflow.
        </p>
      </section>
    );
  if (tab === "Analytics")
    return (
      <section className={styles.panel}>
        <h2>What’s helping your team?</h2>
        <p>
          Content activity and self-reported results. These do not prove
          business attribution.
        </p>
        <div className={styles.stats}>
          {Object.entries(report?.counts || {}).map(([key, value]) => (
            <div key={key}>
              <strong>{value}</strong>
              <span>{key}</span>
            </div>
          ))}
        </div>
        <h3>Feedback</h3>
        {report?.feedback.map((f, i) => (
          <p key={i}>
            {f.reason || f.action}: {f.total}
          </p>
        ))}
        <h3>Preparation activity</h3>
        {report?.jobs.map((j) => (
          <div className={styles.idea} key={j.id}>
            <span>
              {j.kind} · {j.status} ·{" "}
              {new Date(j.created_at).toLocaleDateString()}
            </span>
            <span>
              {j.attempts} attempt(s){j.error_code ? ` · ${j.error_code}` : ""}
            </span>
          </div>
        ))}
      </section>
    );
  return (
    <>
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Team content at a glance</p>
        <h2>Make participation feel effortless.</h2>
        <p>Give your team useful context and room to sound like themselves.</p>
        <div className={styles.stats}>
          <div>
            <strong>
              {report?.people.filter((p) => p.enrolled).length || 0}
            </strong>
            <span>opted in</span>
          </div>
          <div>
            <strong>{report?.counts.drafts || 0}</strong>
            <span>drafts prepared</span>
          </div>
          <div>
            <strong>{report?.counts.published || 0}</strong>
            <span>posts recorded</span>
          </div>
        </div>
      </section>
      <section className={styles.section}>
        <h2>Company review</h2>
        <p>
          Only drafts explicitly submitted for review appear here. Employees
          give final approval after your review.
        </p>
        {review.map((d) => (
          <article className={styles.post} key={d.id}>
            <p className={styles.postText}>{d.body}</p>
            <p>{d.details.riskFlags?.join(" · ")}</p>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                disabled={busy}
                onClick={() =>
                  command("review", { id: d.id, revision: d.revision })
                }
              >
                Return for final approval
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  command("request_changes", { id: d.id, revision: d.revision })
                }
              >
                Request changes
              </button>
            </div>
          </article>
        ))}
        {!review.length && (
          <div className={styles.empty}>
            Nothing waiting for company review.
          </div>
        )}
      </section>
    </>
  );
}
