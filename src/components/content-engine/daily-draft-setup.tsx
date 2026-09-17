"use client";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Mail,
  MessageCircle,
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
  { id: "imessage", label: "iMessage", Icon: MessageCircle },
  { id: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
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
  const [profile, setProfile] = useState<ContentProfile>(
    data.profile?.config || { ...defaultProfile, role: "", topics: [] },
  );
  const [consent, setConsent] = useState(false),
    [starting, setStarting] = useState(false),
    [saved, setSaved] = useState(false);
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
    if (!enrolled && !starting) {
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
          <Sparkles size={29} strokeWidth={1.5} />
          <span />
        </div>
        <h1>Let AI draft your content</h1>
        <p>
          Get views, leads, and sales on autopilot
          <br className={styles.desktopBreak} /> with the help of AI.
        </p>
      </header>
      <form
        className={styles.setup}
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className={styles.formFields}>
          <div className={styles.quantity}>
            <span>Send me</span>
            <select
              aria-label="Drafts per day"
              value={count}
              onChange={(e) => change({ daily_count: Number(e.target.value) })}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <span>{count === 1 ? "draft" : "drafts"} per day.</span>
          </div>
          <p className={styles.quantityNote}>
            A daily head start. In your voice.
          </p>
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
              {channel.label} delivery is not connected yet. Your drafts will be
              available here in the app.
            </p>
          </div>
          {(starting || enrolled) && (
            <details
              className={styles.preferences}
              open={starting || undefined}
            >
              <summary>
                Make it yours <ChevronRight size={14} />
              </summary>
              <div className={styles.fields}>
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
                        topics: e.target.value.split(",").map((t) => t.trim()),
                      })
                    }
                  />
                </label>
                <label>
                  Write for
                  <select
                    value={profile.platform}
                    onChange={(e) =>
                      change({ platform: e.target.value as "linkedin" | "x" })
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
                    onChange={(e) => change({ hour: Number(e.target.value) })}
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
          <button
            className={styles.start}
            disabled={
              busy || (!demo && (!data.strategy.enabled || data.setupError))
            }
          >
            {busy ? (
              "Saving…"
            ) : saved ? (
              <>
                Preferences saved <Check size={17} />
              </>
            ) : demo && !enrolled ? (
              <>
                Preview daily drafts <ArrowRight size={17} />
              </>
            ) : paused ? (
              <>
                Resume daily drafts <ArrowRight size={17} />
              </>
            ) : enrolled ? (
              <>
                Save daily drafts <ArrowRight size={17} />
              </>
            ) : (
              <>
                Start daily drafts <ArrowRight size={17} />
              </>
            )}
          </button>
          <p className={styles.review}>
            All you need to do is review and publish.
          </p>
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
        <span>Fresh content to publish. Every day.</span>
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
      {demo && <p className={styles.demo}>Sample workspace · Preview only</p>}
    </div>
  );
}
