import Link from "next/link";
import { workspace } from "@/lib/supabase/server";
import { providerReady } from "@/lib/ai/daily";
import { saveDaily, controlDaily } from "./actions";
import Drafts from "../drafts/page";
export default async function AI({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { db, org, user, member } = await workspace();
  const { notice } = await searchParams;
  const [{ data: s, error }, { data: runs }] = await Promise.all([
    db
      .from("daily_schedules")
      .select("*")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    db
      .from("daily_runs")
      .select("id,status,local_date,error_code")
      .eq("organization_id", org.id)
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(7),
  ]);
  const ready = providerReady("openai") || providerReady("anthropic");
  const messages: Record<string, string> = {
    saved: "Daily drafts are on. Your next run is shown below.",
    paused: "Daily drafting is paused.",
    checked:
      "Run checked. See the latest result below; completed days are not generated twice.",
    invalid: "Check the form and approve the source context.",
    setup: "Your administrator needs to configure API access first.",
    context:
      "Add a role in your profile and approved business context in company settings.",
    failed: "Could not save. Check setup and refresh.",
    limit: "Please wait before trying again.",
  };
  return (
    <div className="v1">
      <p className="eyebrow">Your experience. A daily head start.</p>
      <h1>Let your ideas do more.</h1>
      <p>
        Three fresh post options, ready for your review. You choose what goes
        out.
      </p>
      {notice && (
        <p role="status" className="live-notice">
          {messages[notice] || "Review the result below."}
        </p>
      )}
      <div className="v1-hero">
        <span className="v1-badge">
          {s?.enabled ? "Daily drafts on" : "You’re in control"}
        </span>
        <h2>
          Show up consistently.
          <br />
          Keep sounding like you.
        </h2>
        <p>
          Choose Claude or OpenAI, add context you can share, and set a daily
          time.
        </p>
        <div className="live-inline">
          <Link href="/workspace/profile">My role & interests</Link>
          {["owner", "admin"].includes(member.role) && (
            <Link href="/workspace/settings">Business context</Link>
          )}
          <Link href="/workspace/connections">Social accounts</Link>
        </div>
      </div>
      {!ready && (
        <section className="v1-card">
          <h3>One setup step before the first draft.</h3>
          <p>
            Ask your administrator to add OpenAI or Anthropic API credentials in
            hosting settings. API usage is billed separately from personal
            ChatGPT or Claude subscriptions.
          </p>
          <Link href="/setup">Open setup checklist</Link>
        </section>
      )}
      {error ? (
        <p role="alert">
          Apply the latest database migrations to enable schedules.
        </p>
      ) : (
        <div className="v1-two">
          <form action={saveDaily} className="v1-card v1-form">
            <h2>Your daily drafts</h2>
            <label>
              Writing AI
              <select
                name="provider"
                defaultValue={
                  s?.provider ||
                  (providerReady("openai") ? "openai" : "anthropic")
                }
              >
                <option value="openai" disabled={!providerReady("openai")}>
                  OpenAI {providerReady("openai") ? "" : "· setup needed"}
                </option>
                <option
                  value="anthropic"
                  disabled={!providerReady("anthropic")}
                >
                  Claude {providerReady("anthropic") ? "" : "· setup needed"}
                </option>
              </select>
            </label>
            <label>
              Write for
              <select name="channel" defaultValue={s?.channel || "linkedin"}>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X</option>
              </select>
            </label>
            <label>
              Delivery hour
              <select name="hour" defaultValue={s?.delivery_hour ?? 9}>
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
                name="timezone"
                defaultValue={s?.timezone || org.timezone}
                required
                maxLength={100}
              />
            </label>
            <label>
              Approved context for your posts
              <textarea
                name="context"
                required
                minLength={20}
                maxLength={6000}
                defaultValue={s?.context || ""}
                placeholder="What do you help people do? What can you publicly say about your work and business?"
              />
            </label>
            <label className="check-label">
              <input type="checkbox" name="consent" required />I approve sharing
              this context and my role with the selected AI provider. It
              contains no confidential or customer-identifying details.
            </label>
            <button
              disabled={!ready || !member.opted_in_at}
              className="live-button"
            >
              {s?.enabled ? "Save daily draft settings" : "Start daily drafts"}
            </button>
            <small>
              Runs within the next available 15-minute slot. One batch of three
              per local day. Pilot queue processes two members per slot; busy
              periods can delay delivery.
            </small>
            {!member.opted_in_at && (
              <Link href="/workspace/profile">Join the program first</Link>
            )}
          </form>
          <section className="v1-card">
            <h2>Your routine</h2>
            <p>
              {s?.enabled
                ? `Next run: ${new Date(s.next_run_at).toLocaleString("en-US", { timeZone: s.timezone })} (${s.timezone})`
                : "Your schedule is paused or not yet set."}
            </p>
            {s && (
              <form action={controlDaily}>
                <button
                  name="operation"
                  value="run"
                  className="live-button"
                  disabled={!ready}
                >
                  Generate today’s options
                </button>
                {s.enabled && (
                  <button
                    name="operation"
                    value="pause"
                    className="live-button secondary"
                  >
                    Pause daily drafts
                  </button>
                )}
              </form>
            )}
            <h3>Recent runs</h3>
            {!runs?.length ? (
              <p>No runs yet.</p>
            ) : (
              <ul>
                {runs.map((r) => (
                  <li key={r.id}>
                    {r.local_date} · {r.status}
                    {r.error_code === "provider_unavailable"
                      ? " · API setup needed"
                      : r.error_code === "generation_failed"
                        ? " · generation failed; retry today or wait for the next run"
                        : r.error_code === "context_changed"
                          ? " · settings or consent changed"
                          : ""}
                  </li>
                ))}
              </ul>
            )}
            <p className="v1-note">
              Drafts stay private. Review the facts, edit the wording, and
              approve the saved text before publishing.
            </p>
          </section>
        </div>
      )}
      <section className="v1-card">
        <h2>More work context</h2>
        <p>
          Use approved notes above today. Native Fathom, Slack, and CRM
          connections are not connected in this build.
        </p>
        <div className="live-inline">
          {["Fathom", "Slack", "CRM"].map((name) => (
            <span className="v1-badge" key={name}>
              {name} · planned
            </span>
          ))}
        </div>
      </section>
      <section style={{ marginTop: 40 }}>
        <h2>Your draft inbox</h2>
        <Drafts searchParams={Promise.resolve({})} />
      </section>
    </div>
  );
}
