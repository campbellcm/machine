"use client";
import { useState } from "react";
import { createReward } from "@/app/workspace/rewards/actions";
const templates = [
  {
    title: "Share your expertise",
    metric: "published_posts",
    rules: "Most verified workspace publications during the challenge.",
  },
  {
    title: "Monthly click challenge",
    metric: "unique_clicks",
    rules: "Most unique tracked clicks during the challenge.",
  },
  {
    title: "Show up consistently",
    metric: "active_days",
    rules:
      "Most distinct publishing days in the company timezone. Multiple posts on a day count once.",
  },
  {
    title: "Your next chapter",
    metric: "improvement_posts",
    rules:
      "Largest increase in published posts versus the equally long window immediately before this challenge. Absolute improvement, never below zero.",
  },
  {
    title: "First voice",
    metric: "first_post",
    rules:
      "First recorded participating publication falls inside this challenge. Earliest qualifying publication wins; earlier untracked history cannot be verified.",
  },
  {
    title: "Together we grow",
    metric: "team_posts",
    rules:
      "Reach the shared publication target. Every eligible member who contributes at least one post qualifies for the company prize when the team reaches its goal.",
  },
  {
    title: "Start conversations",
    metric: "leads",
    rules: "Most attributed lead and demo-booked events during the challenge.",
  },
];
export function RewardCreate() {
  const [choice, setChoice] = useState(0);
  const t = templates[choice];
  return (
    <details className="v1-card">
      <summary>Create a reward</summary>
      <label>
        Start from a template
        <select
          value={choice}
          onChange={(e) => setChoice(Number(e.target.value))}
        >
          {templates.map((t, i) => (
            <option key={t.metric} value={i}>
              {t.title}
            </option>
          ))}
        </select>
      </label>
      <form action={createReward} className="v1-form" key={choice}>
        <label>
          Title
          <input name="title" required maxLength={100} defaultValue={t.title} />
        </label>
        <label>
          Prize
          <input
            name="prize"
            required
            maxLength={500}
            placeholder="$1,000, a MacBook Pro, a trip…"
          />
        </label>
        <input type="hidden" name="metric" value={t.metric} />
        {t.metric === "team_posts" && (
          <label>
            Team post target
            <input
              type="number"
              name="target"
              required
              min={1}
              max={100000}
              defaultValue={20}
            />
          </label>
        )}
        <label>
          Additional prize details
          <textarea
            name="rules"
            maxLength={8000}
            placeholder="Eligibility details and what the company will deliver"
          />
        </label>
        <p>{t.rules}</p>
        <label>
          Starts (date, time and UTC offset)
          <input
            name="start"
            required
            placeholder="2026-10-01T00:00:00-04:00"
          />
        </label>
        <label>
          Ends (date, time and UTC offset)
          <input name="end" required placeholder="2026-11-01T00:00:00-04:00" />
        </label>
        <p>
          Eligible opted-in members participate. Results settle for 72 hours.
          Individual ties use earliest final scoring event, then stable member
          ID. Rules and prize lock on creation; the company delivers the prize
          outside the app. No payments are processed.
        </p>
        <button className="live-button">Create reward</button>
      </form>
    </details>
  );
}
