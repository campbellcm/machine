"use client";
import { useState, useRef, useEffect } from "react";
import {
  AudioLines,
  ArrowRight,
  Check,
  Clipboard,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { recorders } from "@/lib/calls/providers";
import { PageHeading } from "../shared";
import { Button } from "../ui/button";
import {
  sampleCalls,
  sampleThemes,
  sampleSensitiveDetails,
  evidenceForTheme,
  type SampleTheme,
} from "@/lib/calls/demo";
import {
  redactKnownDetails,
  checkSampleDraft,
  canCopySampleDraft,
} from "@/lib/calls/privacy";

export function CallStories() {
  const [selectedCalls, setSelectedCalls] = useState(
    sampleCalls.map((c) => c.id),
  );
  const [selectedTheme, setSelectedTheme] = useState<SampleTheme | null>(null);
  const [body, setBody] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (selectedTheme) editorRef.current?.focus();
  }, [selectedTheme]);
  const [accuracy, setAccuracy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [approvedBody, setApprovedBody] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showSources, setShowSources] = useState(false);
  const calls = sampleCalls.filter((c) => selectedCalls.includes(c.id));
  const details = calls
    .flatMap((c) => c.excerpts)
    .reduce(
      (total, e) =>
        total +
        redactKnownDetails(e.text, sampleSensitiveDetails).findings.reduce(
          (sum, f) => sum + f.count,
          0,
        ),
      0,
    );
  const issues = checkSampleDraft(body, sampleSensitiveDetails);
  function resetDraft() {
    setSelectedTheme(null);
    setBody("");
    setAccuracy(false);
    setPrivacy(false);
    setApprovedBody(null);
    setMessage("");
  }
  function chooseTheme(theme: SampleTheme) {
    setSelectedTheme(theme);
    setBody(theme.draft);
    setAccuracy(false);
    setPrivacy(false);
    setApprovedBody(null);
    setMessage("");
  }
  async function copy() {
    if (!canCopySampleDraft(body, approvedBody, sampleSensitiveDetails)) return;
    try {
      await navigator.clipboard.writeText(body);
      setMessage("Draft copied. You decide where and when to post.");
    } catch {
      setMessage(
        "Clipboard access is unavailable. Select the reviewed text and copy it manually.",
      );
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="FROM CONVERSATION TO CONTENT"
        title="Your best ideas are already on the call."
        description="Turn everyday conversations into useful stories, with the details kept private."
      />
      <div className="calls-demo-notice">
        <LockKeyhole size={17} />
        <p>
          <strong>Interactive sample · No live connection</strong>
          <span>
            These calls and themes are fictional, and drafts are prepared
            examples. No recordings are imported and no AI is called.
          </span>
        </p>
      </div>
      <section
        className="recorder-grid"
        aria-label="Planned call recorder integrations"
      >
        {recorders.map((provider) => (
          <article className="panel recorder-card" key={provider.id}>
            <span className={`recorder-mark ${provider.id}`}>
              {provider.mark}
            </span>
            <div>
              <h2>{provider.name}</h2>
              <p>{provider.method}</p>
            </div>
            <span className="pill">{provider.status}</span>
            <details className="provider-requirements">
              <summary>Access requirements</summary>
              <p>{provider.requirement}</p>
              <a href={provider.docs} target="_blank" rel="noreferrer">
                Provider documentation ↗
              </a>
            </details>
          </article>
        ))}
      </section>
      <div className="calls-flow">
        <span>
          <b>1</b> Choose calls
        </span>
        <ArrowRight size={14} />
        <span>
          <b>2</b> Review themes
        </span>
        <ArrowRight size={14} />
        <span>
          <b>3</b> Make it yours
        </span>
      </div>
      <div className="call-workbench">
        <section className="panel call-inbox">
          <div className="panel-heading">
            <div>
              <h2>Your sample calls</h2>
              <p>Select the conversations to include.</p>
            </div>
            <AudioLines size={19} />
          </div>
          <div className="sample-call-list">
            {sampleCalls.map((call) => (
              <label
                key={call.id}
                className={`sample-call ${selectedCalls.includes(call.id) ? "included" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selectedCalls.includes(call.id)}
                  onChange={() => {
                    setSelectedCalls((ids) =>
                      ids.includes(call.id)
                        ? ids.filter((id) => id !== call.id)
                        : [...ids, call.id],
                    );
                    resetDraft();
                  }}
                />
                <span>
                  <strong>{call.title}</strong>
                  <small>
                    {call.date} · {call.duration} · {call.category}
                  </small>
                </span>
              </label>
            ))}
          </div>
          <div className="privacy-summary">
            <ShieldCheck size={18} />
            <div>
              <strong>{details} known details masked in sample excerpts</strong>
              <p>
                Customer names, contact details, a commercial amount, and
                unreleased roadmap details.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setShowSources(!showSources)}
            aria-expanded={showSources}
          >
            {showSources ? "Hide" : "Review"} sample source excerpts{" "}
            <FileText size={15} />
          </Button>
          {showSources && (
            <div className="call-excerpts">
              {calls.map((call) => (
                <div key={call.id}>
                  <h3>{call.title}</h3>
                  {call.excerpts.map((e) => (
                    <div className="call-excerpt" key={e.id}>
                      <small>
                        {e.at} · {e.speaker}
                      </small>
                      <p>
                        {
                          redactKnownDetails(e.text, sampleSensitiveDetails)
                            .text
                        }
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <p className="calls-fine-print">
            This demo masks a known list of fictional details. Real
            anonymization must also check context that could identify a
            customer.
          </p>
        </section>
        <section className="call-themes" aria-label="Sample themes">
          <div className="section-label">
            <h2>The ideas beneath the conversation</h2>
            <span>Prepared sample themes</span>
          </div>
          {selectedCalls.length === 0 ? (
            <div className="panel empty-state">
              <AudioLines />
              <h2>Start with a conversation.</h2>
              <p>Select a sample call to explore its themes.</p>
            </div>
          ) : (
            sampleThemes.map((theme) => {
              const evidence = evidenceForTheme(theme, calls);
              if (!evidence.length) return null;
              const count = new Set(evidence.map((e) => e.callId)).size;
              return (
                <article
                  className={`panel call-theme ${selectedTheme?.id === theme.id ? "chosen" : ""}`}
                  key={theme.id}
                >
                  <div className="theme-eyebrow">
                    <Sparkles size={14} />
                    <span>
                      {count > 1 ? "Recurring theme" : "Single-call idea"} ·{" "}
                      {count} {count === 1 ? "call" : "calls"}
                    </span>
                  </div>
                  <h2>{theme.title}</h2>
                  <p>{theme.description}</p>
                  <details>
                    <summary>Why this idea · view evidence</summary>
                    <p>
                      {count > 1
                        ? theme.reason
                        : "Only one selected call supports this idea. It is not yet a recurring pattern in your selection."}
                    </p>
                    {evidence.map((e) => (
                      <blockquote key={e.id}>
                        <p>{e.text}</p>
                        <cite>
                          {e.callTitle} · {e.at} · {e.speaker}
                        </cite>
                      </blockquote>
                    ))}
                  </details>
                  <Button
                    variant={
                      selectedTheme?.id === theme.id ? "secondary" : "ghost"
                    }
                    onClick={() => chooseTheme(theme)}
                  >
                    {selectedTheme?.id === theme.id
                      ? "Reset sample draft"
                      : "Build sample draft"}
                    <ArrowRight size={15} />
                  </Button>
                </article>
              );
            })
          )}
        </section>
      </div>
      {selectedTheme && (
        <section className="panel call-draft" aria-labelledby="draft-title">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR VOICE. YOUR FINAL SAY.</p>
              <h2 id="draft-title">{selectedTheme.title}</h2>
            </div>
            <span className="pill">LinkedIn · Sample draft</span>
          </div>
          <p className="draft-disclosure-note">
            Customer identities and confidential details are omitted. Your
            employer’s name stays in the employment disclosure.
          </p>
          <label className="draft-editor-label" htmlFor="call-draft-body">
            Edit your sample post{" "}
            <span>
              Use fictional information only. Changes stay in this page session.
            </span>
          </label>
          <textarea
            ref={editorRef}
            id="call-draft-body"
            className="call-draft-editor"
            value={body}
            maxLength={10000}
            onChange={(e) => {
              setBody(e.target.value);
              setAccuracy(false);
              setPrivacy(false);
              setApprovedBody(null);
              setMessage("");
            }}
          />
          <div className="draft-meta">
            <span>{body.length.toLocaleString()} / 3,000 characters</span>
            <span>Prepared example · not AI-generated</span>
          </div>
          {issues.length > 0 && (
            <ul className="draft-issues" aria-label="Draft issues">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          <div className="draft-review">
            <label>
              <input
                type="checkbox"
                checked={accuracy}
                onChange={(e) => {
                  setAccuracy(e.target.checked);
                  setApprovedBody(null);
                  setMessage("");
                }}
              />
              I reviewed the sample facts and this reflects the author’s
              perspective.
            </label>
            <label>
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => {
                  setPrivacy(e.target.checked);
                  setApprovedBody(null);
                  setMessage("");
                }}
              />
              I checked for identifying or confidential details, including
              indirect clues.
            </label>
          </div>
          <div className="draft-actions">
            <Button
              disabled={!accuracy || !privacy || issues.length > 0}
              onClick={() => {
                if (accuracy && privacy && !issues.length) {
                  setApprovedBody(body);
                  setMessage(
                    "This version is reviewed and ready to copy. Editing requires another review.",
                  );
                }
              }}
            >
              <Check size={16} />
              {approvedBody === body
                ? "Sample reviewed"
                : "Mark sample reviewed"}
            </Button>
            <Button
              variant="secondary"
              disabled={
                !canCopySampleDraft(body, approvedBody, sampleSensitiveDetails)
              }
              onClick={copy}
            >
              <Clipboard size={15} />
              Copy reviewed draft
            </Button>
            <Button variant="ghost" onClick={resetDraft}>
              <RotateCcw size={15} />
              Discard sample
            </Button>
          </div>
          <p role="status" className="copy-status">
            {message}
          </p>
          <p className="calls-fine-print">
            Privacy checks assist your review; they do not certify anonymity.
            Nothing is published automatically.
          </p>
        </section>
      )}
      <div className="calls-next">
        <ShieldCheck size={21} />
        <div>
          <strong>Connect the work you already do.</strong>
          <p>
            The live version will let teammates authorize eligible calls,
            receive private draft suggestions, and approve each post themselves.
            Sign-in, protected storage, provider authorization, and semantic
            privacy checks come before real imports.
          </p>
        </div>
      </div>
    </>
  );
}
