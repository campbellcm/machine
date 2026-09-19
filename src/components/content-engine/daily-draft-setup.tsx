"use client";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  SlidersHorizontal,
  WandSparkles,
  Check,
  Mail,
  Hash,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Pause,
} from "lucide-react";
import {
  defaultProfile,
  type ContentProfile,
} from "@/lib/content-engine/domain";
import type { EngineData } from "@/lib/content-engine/types";
import styles from "./daily-draft-setup.module.css";
const channels = [
  { id: "email", label: "Email", Icon: Mail },
  { id: "slack", label: "Slack", Icon: Hash },
] as const;
type Command = (
  operation: string,
  input?: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;
export function DailyDraftSetup({
  data,
  demo,
  busy,
  message,
  command,
  onDrafts,
  onSettings,
  onAdmin,
}: {
  data: EngineData;
  demo: boolean;
  busy: boolean;
  message: string;
  command: Command;
  onDrafts: () => void;
  onSettings: () => void;
  onAdmin: () => void;
}) {
  const [profile, setProfile] = useState<ContentProfile>(() => {
    const initial = data.profile?.config || {
      ...defaultProfile,
      role: "",
      topics: [],
    };
    return {
      ...initial,
      delivery_preference: ["whatsapp", "imessage"].includes(
        initial.delivery_preference,
      )
        ? "email"
        : initial.delivery_preference,
    };
  });
  const [consent, setConsent] = useState(false),
    [starting, setStarting] = useState(false),
    [saved, setSaved] = useState(false);
  const [topic, setTopic] = useState("");
  const [request, setRequest] = useState<{ topic: string; job: string } | null>(
    null,
  );
  const [chatError, setChatError] = useState("");
  const [openedAt] = useState(() => Date.now());
  const ideas = data.ideas.filter(
    (idea) =>
      idea.status !== "dismissed" && Date.parse(idea.expires_at) > openedAt,
  );
  const [ideaId, setIdeaId] = useState(ideas[0]?.id || "");
  const selectedIdea = ideas.find((idea) => idea.id === ideaId) || ideas[0];
  const job = data.jobs.find((item) => item.id === request?.job);
  const responses = data.drafts.filter(
    (draft) => draft.is_owner && draft.job_id === request?.job && request,
  );
  const chatAvailable =
    demo ||
    (data.ready &&
      data.strategy.enabled &&
      !data.setupError &&
      !!data.profile?.enrolled &&
      !data.profile.paused);
  async function sendTopic() {
    if (busy || !topic.trim() || !selectedIdea || !chatAvailable) return;
    setChatError("");
    const result = await command("chat", {
      id: selectedIdea.id,
      instruction: topic.trim(),
      key: crypto.randomUUID(),
    });
    if (result && typeof result.id === "string") {
      setRequest({ topic: topic.trim(), job: result.id });
      setTopic("");
    } else {
      setChatError(
        "Your request could not be completed. Your topic is still here—please try again.",
      );
    }
  }
  const count = profile.daily_count;
  const channel =
    channels.find((c) => c.id === profile.delivery_preference) || channels[0];
  const enrolled = !!data.profile?.enrolled,
    paused = !!data.profile?.paused;
  const available = data.drafts.filter(
    (d) =>
      d.is_owner && !["archived", "published", "rejected"].includes(d.state),
  ).length;
  const change = (patch: Partial<ContentProfile>) => {
    setProfile({ ...profile, ...patch });
    setSaved(false);
  };
  async function save() {
    if (!starting) {
      setStarting(true);
      return;
    }
    if (!enrolled && !consent) return;
    setSaved(false);
    const result = await command("profile", {
      config: { ...profile, cadence: "daily", delivery: "app" },
      consent: true,
      step: 6,
    });
    if (result) {
      if (paused && !(await command("resume"))) return;
      setSaved(true);
      setStarting(false);
    }
  }
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.emblem} aria-hidden="true">
          <Sparkles size={25} strokeWidth={1.4} />
        </div>
        <p className={styles.eyebrow}>A little inspiration. Entirely you.</p>
        <h1>
          Let AI create
          <br /> <span>your content.</span>
        </h1>
      </header>
      <section className={styles.studio} aria-label="AI content chat">
        {request && (
          <div className={styles.conversation}>
            <p className={styles.userMessage}>{request.topic}</p>
            <div className={styles.answer}>
              <span className={styles.answerLabel}>
                <Sparkles size={15} />{" "}
                {demo ? "Sample response" : "Your writing assistant"}
              </span>
              {responses.length ? (
                <>
                  {demo && (
                    <p className={styles.finePrint}>
                      This is a prepared example, not an AI response to your
                      topic. Live drafting uses your company’s OpenAI
                      connection.
                    </p>
                  )}
                  <p className={styles.draftBody}>{responses[0].body}</p>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={onDrafts}
                  >
                    Review {responses.length > 1 ? "your drafts" : "this draft"}{" "}
                    <ArrowRight size={14} />
                  </button>
                </>
              ) : (
                <p role="status">
                  {job?.status === "failed"
                    ? "We couldn’t prepare a draft. Try again or check your company’s AI setup."
                    : job?.status === "canceled"
                      ? "This request was canceled. Resume AI drafting to try again."
                      : job?.status === "completed"
                        ? "Your drafts are ready in Your drafts."
                        : "Your topic is in the preparation queue. Your drafts will appear here when ready."}
                </p>
              )}
            </div>
          </div>
        )}
        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void sendTopic();
          }}
        >
          <textarea
            aria-label="Post topic"
            placeholder="Give me a topic and I’ll draft a post for you"
            value={topic}
            maxLength={500}
            rows={3}
            disabled={busy}
            onChange={(event) => setTopic(event.target.value)}
          />
          <div className={styles.composerBar}>
            <span className={styles.powered}>
              <WandSparkles size={16} /> ChatGPT{" "}
              <span>· Powered by OpenAI</span>
            </span>
            <button
              type="submit"
              className={styles.send}
              aria-label="Draft my post"
              disabled={
                busy || !topic.trim() || !selectedIdea || !chatAvailable
              }
            >
              <ArrowUp size={21} />
            </button>
          </div>
        </form>
        <div className={styles.contextBar}>
          <details>
            <summary>
              <SlidersHorizontal size={13} /> Writing context
            </summary>
            <div className={styles.contextFields}>
              <label>
                Approved context
                <select
                  aria-label="Approved context"
                  value={selectedIdea?.id || ""}
                  disabled={busy}
                  onChange={(event) => setIdeaId(event.target.value)}
                >
                  {!ideas.length && (
                    <option value="">Add approved context first</option>
                  )}
                  {ideas.map((idea) => (
                    <option value={idea.id} key={idea.id}>
                      {idea.title}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Uses your topic and this approved context. No invented company
                claims. Each request starts a new draft.
              </p>
              <button
                type="button"
                className={styles.textButton}
                onClick={onSettings}
              >
                Manage your context <ChevronRight size={13} />
              </button>
            </div>
          </details>
          <span>
            {profile.platform === "x" ? "X" : "LinkedIn"} · In your voice
          </span>
        </div>
        {busy && (
          <p role="status" className={styles.chatNotice}>
            Working on it…
          </p>
        )}
        {chatError && (
          <p role="alert" className={styles.chatNotice}>
            {chatError} {message}
          </p>
        )}
        {!chatAvailable && (
          <p className={styles.chatNotice}>
            Finish company AI setup and enable your content profile to start
            drafting.{" "}
            <button
              type="button"
              className={styles.textButton}
              onClick={onSettings}
            >
              Open preferences <ArrowRight size={12} />
            </button>
          </p>
        )}
        {!selectedIdea && (
          <p className={styles.chatNotice}>
            Add an approved note in Content preferences, then prepare ideas to
            give your assistant writing context.
          </p>
        )}
      </section>
      <div className={styles.divider}>
        <span>OR LET INSPIRATION COME TO YOU</span>
      </div>
      <form
        className={styles.setup}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className={styles.formFields}>
          <h2 className={styles.dailyHeading}>
            Or get {count} AI {count === 1 ? "draft" : "drafts"} per day
            <br /> delivered via email or Slack.
          </h2>
          <p className={styles.quantityNote}>
            Ready when you are. Just review and publish.
          </p>
          {starting && (
            <>
              <div className={styles.delivery}>
                <p className={styles.label}>Receive your drafts via</p>
                <div
                  className={styles.channels}
                  role="group"
                  aria-label="Draft delivery preference"
                >
                  {channels.map(({ id, label, Icon }) => (
                    <button
                      type="button"
                      key={id}
                      aria-pressed={profile.delivery_preference === id}
                      onClick={() => change({ delivery_preference: id })}
                    >
                      <span className={`${styles.channelIcon} ${styles[id]}`}>
                        <Icon size={23} strokeWidth={1.7} />
                      </span>
                      <span>{label}</span>
                      {profile.delivery_preference === id && (
                        <Check size={14} className={styles.selectedCheck} />
                      )}
                    </button>
                  ))}
                </div>
                <p className={styles.deliveryNote}>
                  {demo
                    ? "Sample preference only. Drafts stay in this preview."
                    : channel.id === "email"
                      ? data.delivery?.emailReady
                        ? "Daily draft notifications will go to your verified sign-in email, with a link to review here."
                        : "Your company needs to configure its email sender. Drafts remain available here."
                      : data.delivery?.slackConnected
                        ? "Daily draft notifications will go to your connected Slack account, with a link to review here."
                        : "Connect Slack in Delivery connections below. Drafts remain available here."}
                </p>
              </div>
              {starting && (
                <details
                  className={styles.preferences}
                  open={starting || undefined}
                >
                  <summary>
                    Make it yours <ChevronRight size={14} />
                  </summary>
                  <div className={styles.fields}>
                    <label>
                      Drafts per day
                      <select
                        aria-label="Drafts per day"
                        value={count}
                        onChange={(e) =>
                          change({ daily_count: Number(e.target.value) })
                        }
                      >
                        {Array.from({ length: 10 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Your role
                      <input
                        value={profile.role}
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="e.g. Founder, sales lead, engineer"
                        onChange={(e) => change({ role: e.target.value })}
                      />
                    </label>
                    <label>
                      Topics you talk about
                      <input
                        value={profile.topics.join(", ")}
                        required
                        placeholder="e.g. Customer stories, industry trends"
                        onChange={(e) =>
                          change({
                            topics: e.target.value
                              .split(",")
                              .map((t) => t.trim()),
                          })
                        }
                      />
                    </label>
                    <label>
                      Write for
                      <select
                        value={profile.platform}
                        onChange={(e) =>
                          change({
                            platform: e.target.value as "linkedin" | "x",
                          })
                        }
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="x">X</option>
                      </select>
                    </label>
                    <label>
                      Ready around
                      <select
                        value={profile.hour}
                        onChange={(e) =>
                          change({ hour: Number(e.target.value) })
                        }
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
                        value={profile.timezone}
                        required
                        onChange={(e) => change({ timezone: e.target.value })}
                      />
                    </label>
                  </div>
                </details>
              )}
              {starting && !enrolled && (
                <label className={styles.consent}>
                  <input
                    type="checkbox"
                    checked={consent}
                    required
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I opt in to AI drafting using my approved notes and writing
                  preferences. I can pause anytime.
                </label>
              )}
            </>
          )}
          <button
            className={styles.start}
            disabled={
              busy || (!demo && (!data.strategy.enabled || data.setupError))
            }
          >
            {busy ? (
              "Working…"
            ) : saved ? (
              <>
                Preferences saved <Check size={16} />
              </>
            ) : (
              <>
                Make my content <ArrowRight size={16} />
              </>
            )}
          </button>
          {!starting && (
            <p className={styles.deliveryNote}>
              {demo
                ? "Sample workspace. No messages are sent."
                : "Manage email and Slack in Delivery connections below. Your drafts always remain available here."}
            </p>
          )}
          {enrolled && !paused && (
            <button
              type="button"
              className={styles.pause}
              disabled={busy}
              onClick={() => {
                setSaved(false);
                void command("pause");
              }}
            >
              <Pause size={12} />
              Pause daily drafts
            </button>
          )}
          {paused && (
            <p className={styles.deliveryNote}>Your daily drafts are paused.</p>
          )}
          {message && (
            <p role="status" className={styles.status}>
              {saved
                ? demo
                  ? `Sample saved: ${count} ${count === 1 ? "draft" : "drafts"} per day. No messages will be sent.`
                  : `Saved: ${count} ${count === 1 ? "draft" : "drafts"} per day, available in the app.`
                : message}
            </p>
          )}
          {!demo &&
            (!data.ready || !data.strategy.enabled || data.setupError) && (
              <p className={styles.deliveryNote}>
                Your company needs to finish AI setup before daily drafts can
                begin. You can save preferences once AI is enabled.
              </p>
            )}
        </fieldset>
      </form>
      <div className={styles.reassurance}>
        <p>
          <ShieldCheck size={14} />
          You’re in control. Nothing publishes automatically.
        </p>
      </div>
      <div className={styles.links}>
        <button onClick={onDrafts}>
          Your drafts{available > 0 && <span>{available}</span>}
          <ChevronRight size={14} />
        </button>
        <button onClick={onSettings}>
          Content preferences
          <ChevronRight size={14} />
        </button>
        {data.admin && (
          <button onClick={onAdmin}>
            Company settings
            <ChevronRight size={14} />
          </button>
        )}
      </div>
      {demo && (
        <p className={styles.demo}>Sample workspace · No live AI requests</p>
      )}
    </div>
  );
}
