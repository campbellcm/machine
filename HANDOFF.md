# Crewcast Handoff

For any AI assistant or coding agent picking up this project, including ChatGPT (GPT-6 Astra) and Codex.

Last updated: September 16, 2026
Founder: Colin Campbell
Stage: Concept, landing page, and PRD complete. No application code yet. Next milestone: M0 (Foundation).

---

## 1. How to use this handoff

**In ChatGPT or another chat assistant:** upload `HANDOFF.md`, `PRD.md`, and `design/crewcast-landing.html`. Use chat assistants for planning, reviewing pull requests, pressure-testing decisions, writing copy, and preparing partner applications. Starter prompts are in Section 9.

**In Codex or another coding agent:** put this whole folder at the root of the repository. Codex reads `AGENTS.md` automatically. Claude Code reads `CLAUDE.md`, which contains the same rules.

**Source of truth, in order:**
1. `PRD.md`: what to build, acceptance criteria, data model, milestones
2. `AGENTS.md` / `CLAUDE.md`: how to work in the repo, hard rules
3. `HANDOFF.md` (this file): background, decision history, research notes
4. `design/crewcast-landing.html`: visual reference and marketing positioning only

If anything here conflicts with `PRD.md`, the PRD wins.

---

## 2. Files in this kit

| File | What it is |
|---|---|
| `PRD.md` | Full product requirements: 18 features, data model, AI behavior, security checklist, 10 milestones (M0 to M9) |
| `AGENTS.md` | Repo instructions for Codex and other agents |
| `CLAUDE.md` | Same rules as `AGENTS.md`, for Claude Code. Keep both identical |
| `PROGRESS.md` | Build log. Every agent updates it at the end of each milestone |
| `HANDOFF.md` | This file |
| `design/crewcast-landing.html` | Approved landing page with pricing, self-contained HTML |

---

## 3. The product in one paragraph

Crewcast turns a company's employees into an always-on marketing channel. An AI interviews each teammate about their work and turns the answers into LinkedIn posts in their voice. Teammates approve and publish. Personal trackable links and CRM sync (HubSpot, Salesforce) attribute leads and closed deals to the person who drove them. Companies can optionally run private reward challenges, for example a $2,500 bonus for whoever drives the most leads or impressions in a month. Winners are approved in Crewcast and paid through the company's own payroll. Buyers are marketing leaders and founders at B2B companies with roughly 20 to 500 employees.

Working name: Crewcast. The name is a placeholder and has not been trademark checked.

---

## 4. Decision log

These decisions were made deliberately. Don't reverse them without the founder's approval.

| Decision | Why |
|---|---|
| LinkedIn only for v1 | B2B buyers live there. Other networks have access limits that make them weak for employee accounts (see Section 5) |
| Manual publishing mode before API posting | Teammates copy the post, publish on LinkedIn, and paste the link back. The product works for pilots before any LinkedIn API approval |
| Leaderboards score on data Crewcast owns | Link clicks, CRM leads, and verified posts don't depend on gated platform analytics |
| Impressions metric sits behind a feature flag | Per-member post analytics require LinkedIn approval. Impressions are also easier to game, so leads are recommended for cash rewards |
| Rewards are optional, company-set, any amount, and internal only | Founder's product model. Challenges, leaderboards, and amounts are never visible outside the company, and never passed to the AI |
| Posts disclose employment, never the reward | FTC guidance treats employment as a material connection that must be disclosed in the post itself. The reward can stay private. Wording pending legal review |
| Every post needs the teammate's own approval | Authenticity, trust, and platform terms. Admins can review but never approve on someone's behalf |
| Crewcast never holds or moves money | Paying employees directly raises tax withholding and money transmission issues. Payouts go through the company's payroll |
| Payouts in two phases: approval plus export first (M8), direct payroll sync second (M9) | Export works with any payroll provider on day one. Direct sync creates an unsubmitted bonus draft that the payroll admin submits |
| Two-person approval above a company-set threshold | Money controls. The same person can never give both approvals |
| CRM sync stores IDs, stages, and amounts, not contact PII | Data minimization lowers security risk and customer objections |
| No scraping, no "viral post" copying in v1 | Platform terms and plagiarism risk. Ideas come from curated prompts and company context |
| Autopilot in v1 means scheduling interview-based drafts | Fully autonomous drafting is later. The landing page still presents Autopilot and "Mirror what works" as vision features |
| Stack: Next.js, TypeScript, Supabase, Tailwind with shadcn/ui, Vercel, Resend, Stripe, Anthropic API | Mainstream stack that AI coding agents handle well. The AI model name comes from an environment variable |

---

## 5. Research notes (verify before relying on them)

Checked in September 2026. APIs, pricing, and policies change, so agents must confirm against official docs before building.

- **LinkedIn:** posting to personal profiles is available through self-serve access. Per-member post analytics are available only to approved tools, which requires an application.
- **Instagram:** the API can't publish to personal accounts, only professional ones.
- **TikTok:** until an app passes TikTok's audit, only a few users can post per day and posts are private.
- **X:** pay-per-use API pricing. Posts containing URLs cost much more than plain posts, which hurts a product built on trackable links.
- **Gusto:** its API supports creating off-cycle bonus payrolls. Production access requires partner approval and a security review, and approval is not guaranteed. Apply around M6.
- **Unified payroll APIs (Finch):** advertise write-back for deductions and contributions, not bonuses. Not a clear shortcut for payouts.
- **FTC:** employees promoting their employer need to disclose the employment relationship in the post itself. A profile bio is not enough. The dollar amount of any incentive does not need to be disclosed.
- **Bonuses and overtime:** rule-based bonuses for hourly employees may need to be included in overtime calculations. Confirm with a payroll advisor.

None of this is legal or tax advice. The founder checklist in PRD Section 13 includes lawyer and payroll advisor reviews.

---

## 6. Current status and next steps

- Done: concept, landing page with pricing (published), PRD revision 2, agent instruction files.
- Not started: all code. `PROGRESS.md` shows M0.
- Next: founder creates GitHub, Supabase, Vercel, and Anthropic accounts, then a coding agent builds M0.

| Milestone | Scope | External dependency |
|---|---|---|
| M0 | Foundation, app shell, seed data, CI | Accounts above |
| M1 | Orgs, roles, company context, consent | Resend domain |
| M2 | Interview to approved post, manual publishing | None. First demo for design partners |
| M3 | Trackable links, conversions, dashboards | None |
| M4 | Challenges, leaderboards, ideas, weekly report | Legal and payroll advisor review |
| M5 | LinkedIn posting and analytics | LinkedIn developer app, analytics approval |
| M6 | HubSpot and Salesforce sync | Developer accounts |
| M7 | Billing, audit log, hardening | Stripe, external security review |
| M8 | Payout approvals and payroll export | Security review complete |
| M9 | Gusto payroll sync | Gusto partner approval |

---

## 7. Non-negotiables

1. Nothing publishes without the teammate's approval.
2. Reward programs never appear outside the company or in AI inputs.
3. Crewcast never holds, moves, or submits payments or payrolls.
4. No scraping of social networks.
5. No raw IPs, contact PII, bank, tax, or government ID data stored.
6. Row Level Security on every table.
7. Verify third-party API details against current docs before building.

---

## 8. Working across multiple AI tools

- **Pick one primary builder per milestone.** Two agents editing the same branch at once will create conflicts and contradictory decisions.
- **Use the second tool as a reviewer.** Have it check each pull request against the PRD acceptance criteria and security checklist before merging.
- **Keep one shared log.** All progress, decisions, and known issues go in `PROGRESS.md`, never in chat history alone. Chat assistants don't see the repo unless you paste or upload files, so paste the latest `PROGRESS.md` when switching tools.
- **Keep `AGENTS.md` and `CLAUDE.md` identical.** If one changes, copy it to the other.
- **Update this handoff at major changes.** For example, a revised PRD, a changed decision, or a completed milestone.

Founder working preferences: direct, plain-language explanations, exact commands to run, and proactive flagging of risks and credibility issues.

---

## 9. Starter prompts

**Codex, first session:**
> Read AGENTS.md, PRD.md, PROGRESS.md, and HANDOFF.md. We're starting milestone M0. Summarize your plan, list the accounts and keys you need from me, and don't write code until I confirm.

**ChatGPT (GPT-6 Astra), planning or pressure-testing:**
> I've uploaded HANDOFF.md, PRD.md, and my landing page for Crewcast. Read them fully. Then tell me the three biggest risks to getting design partners live by milestone M2, and anything in the PRD that is ambiguous enough to cause a coding agent to build the wrong thing.

**Any tool, pull request review:**
> Review this pull request against the acceptance criteria for [milestone] in PRD.md and the security checklist in PRD Section 11. List anything missing, anything that violates AGENTS.md, and any test gaps. Be specific about files and lines.

**Any tool, resuming after a break:**
> Here is the latest PROGRESS.md. Read it with PRD.md and AGENTS.md, tell me where the build stands in plain language, and recommend the next step.


## September 17 addendum: calls to content

The founder requested using existing day-to-day calls from Fathom and other recorders as a source of draft posts. PRD revision 3 adds F19 / M2a, alongside the interview path. The M0 app now contains a fictional call-to-content preview; it is not connected to a recorder or AI. Fathom is first; the founder subsequently specified required coverage for Granola, Fathom, Fireflies, Circleback, Read AI, Otter.ai, Zoom, and Avoma. The catalog and shared intake contract now cover that list, while all live connectors remain planned. Production must complete M1 authentication/RLS and M2 approval infrastructure before importing real transcripts. See PRD F19 for eligibility, anonymization, source attribution, and connector acceptance criteria. This supersedes the original interview-only assumption, but does not permit autonomous publishing.
