# Crewcast PRD: Version 1 (LinkedIn-first)

Status: Ready to build
Owner: Colin Campbell (founder)
Builder: an AI coding agent (Claude Code, Codex, or similar), working milestone by milestone
Product name: Crewcast (working name, may change, so keep the name in one config value)
Revision: 3 (adds user-requested call-recording-to-content workflow, F19)

---

## 1. Product summary

Crewcast turns a company's employees into an always-on marketing channel. Companies connect their team, give Crewcast context about the business, and Crewcast interviews each teammate to turn their real knowledge into social posts in their own voice. Content can also begin with eligible recordings of the teammate’s existing day-to-day calls (F19): identify useful themes, remove confidential and identifying details, and propose a draft grounded in the conversation. Teammates approve and publish. Every post carries a personal trackable link, and Crewcast syncs with the company's CRM, so leads and revenue are attributed to the person who drove them.

Companies can optionally run internal reward programs. A company decides whether to offer a reward at all, what it is, and how much (for example, "whoever drives the most leads in October gets a $2,500 bonus"). Winners are chosen by the metric the company picks, such as impressions or leads. Reward programs are private to the company: the challenge, the leaderboard, and the reward amount are never shown to anyone outside the organization. Approved cash rewards are paid through the company's own payroll provider.

### The problem

Employees know the company better than any agency, but most never post because they lack time, ideas, and confidence in writing. Companies that do run employee advocacy can't prove it drives pipeline, and rewarding the people who deliver results is a manual, error-prone process.

### The v1 bet

If posting is nearly effortless (a short interview produces ready drafts), results are visible (links and CRM sync prove leads), and wins are rewarded quickly and correctly (payouts land in the next paycheck), teammates will post consistently and companies will keep paying.

### Who it's for

B2B companies, roughly 20 to 500 employees, where sales, customer success, founders, and product people have credibility on LinkedIn. The buyer is a marketing leader or founder. The daily user is any teammate who opts in. Payroll and finance admins are occasional users who approve payouts.

---

## 2. How the coding agent should use this document

1. Read this entire PRD and `AGENTS.md` (or `CLAUDE.md`, which is identical) before writing code.
2. Build one milestone at a time, in the order in Section 10. Do not start the next milestone until the current one meets its acceptance criteria and the founder has tested it.
3. At the end of each milestone, update `PROGRESS.md` with what was built, how to test it, and any open issues.
4. When this PRD is ambiguous, pick the simplest option that satisfies the acceptance criteria, write the decision in `PROGRESS.md` under "Decisions," and keep going. Ask the founder only when a choice is expensive to reverse (data model, auth, third-party vendor, anything touching money, payroll, or security).
5. Third-party APIs change often. Before implementing any LinkedIn, HubSpot, Salesforce, Gusto, Anthropic, Stripe, or Resend integration, check the provider's current official documentation instead of relying on memory. Note the doc version or date in code comments.

---

## 3. Scope

### In scope

| ID | Feature | Milestone |
|---|---|---|
| F1 | Auth, organizations, roles, invites | M1 |
| F2 | Company context, brand settings, employment disclosure settings | M1 |
| F3 | Teammate profile and opt-in consent | M1 |
| F4 | AI interview (text chat) | M2 |
| F5 | Draft generation, editing, and approval | M2 |
| F6 | Manual publishing mode (copy, post on LinkedIn, paste URL back) | M2 |
| F7 | Trackable links, click logging, snippet and webhook conversions | M3 |
| F8 | Teammate and admin dashboards | M3 |
| F9 | Private reward challenges and leaderboards | M4 |
| F10 | Content ideas library (curated plus AI generated) | M4 |
| F11 | Weekly automated email report | M4 |
| F12 | LinkedIn OAuth connection, direct posting, scheduling | M5 |
| F13 | LinkedIn post analytics (impressions), once LinkedIn grants access | M5 |
| F14 | CRM sync: HubSpot and Salesforce | M6 |
| F15 | Admin guardrails and audit log | M2 (basic), M7 (complete) |
| F16 | Billing, monitoring, security hardening | M7 |
| F17 | Reward payouts: approval workflow and payroll export | M8 |
| F18 | Reward payouts: payroll provider sync | M9 |
| F19 | Existing calls to private, anonymized draft suggestions | M2a; Fathom first |

### Out of scope (do not build, but don't design in ways that block them)

1. X, Instagram, TikTok, YouTube, Threads, and Facebook. Keep social account and post metric models provider-agnostic.
2. Voice interviews. Text only. Keep the interview model able to store audio later.
3. Ungrounded "Autopilot" that drafts without an interview or an authorized source call. F19 explicitly permits drafts based on existing eligible calls; this does not authorize autonomous publishing.
4. Trending content research and "mirror a viral post." No scraping of any social network, ever.
5. Crewcast holding, transmitting, or disbursing money itself. Crewcast never touches funds. Cash rewards go through the company's payroll provider, which handles funding, tax withholding, and pay stubs.
6. Calculating tax withholding or overtime adjustments. That is the payroll provider's job.
7. Gift card and non-cash reward fulfillment through third-party providers (possible later).
8. CRMs other than HubSpot and Salesforce.
9. Payroll providers other than those in F18.
10. SSO, SCIM, custom short-link domains, native mobile apps, multiple workspaces per org, non-US payroll sync.

---

## 4. Users, roles, and permissions

All data belongs to an **organization** (tenant). A user can belong to more than one organization, with one role per organization.

| Role | Can do | Billable seat |
|---|---|---|
| Owner | Everything an Admin can, plus billing, delete org, transfer ownership, connect payroll, set payout approval thresholds | Only if they also opt in as a teammate |
| Admin | Manage company context, brand settings, guardrails, invites, challenges, campaigns, CRM connection, view all team analytics and published posts, review posts when admin review is on, first approval on payouts | Only if they also opt in as a teammate |
| Payroll approver | View reward payouts, give final approval, export or send to payroll, mark paid. No access to drafts or interviews | No |
| Teammate | Complete interviews, create and approve own drafts, publish, view own stats, view leaderboards, view own reward history | Yes, once opted in |
| Viewer | View admin dashboard and reports, no editing | No |

A user may hold Admin and Payroll approver together (small companies), but the same person can never give both approvals on a payout that requires two approvals.

Permission rules:

1. A teammate's unpublished drafts are private to that teammate, except when "Admin review required" is on, in which case admins can view drafts only after the teammate submits them for review.
2. Nothing is ever published under a person's name without that person's explicit approval. Admins can never approve on a teammate's behalf.
3. Challenges, leaderboards, reward amounts, and payout records are visible only to members of the organization. Nothing about reward programs is ever included in published posts, public pages, link redirects, or anything a viewer outside the company can see.
4. Teammates see their own payout status and amount. They never see other teammates' payout records, only leaderboard ranks and scores.
5. Enforce every rule at the database level with Supabase Row Level Security, not only in the UI.

---

## 5. Technical decisions

Use these unless the founder approves a change.

| Area | Choice | Notes |
|---|---|---|
| Language | TypeScript, strict mode | |
| Framework | Next.js, latest stable, App Router | Server Actions and Route Handlers |
| UI | Tailwind CSS and shadcn/ui | Follow design direction in Section 9 |
| Database, auth, storage | Supabase (Postgres, Auth, Storage, RLS) | Supabase CLI migrations checked into the repo |
| AI | Anthropic API via the official TypeScript SDK | Model name from `ANTHROPIC_MODEL` env var, never hardcoded. Default `claude-sonnet-5`, verify against current docs |
| Email | Resend with React Email templates | |
| Background jobs | Vercel Cron hitting protected route handlers, plus a `jobs` table | No queue service at first. Revisit at M6 if CRM sync volume requires it |
| Hosting | Vercel | Preview deploys per branch |
| CRM | Direct HubSpot and Salesforce integrations behind a provider interface | A unified CRM API vendor may replace direct integrations later, so keep provider code isolated |
| Payroll | Provider interface with an export adapter (M8) and a Gusto adapter (M9) | A unified payroll API vendor may be evaluated at M9, founder decision |
| Payments (Crewcast subscriptions) | Stripe Billing | M7 |
| Error monitoring | Sentry | M7 |
| Testing | Vitest for unit tests, Playwright for end-to-end tests | |
| Validation | Zod for all inputs, AI outputs, and webhooks | |

Engineering rules:

1. Secrets live only in environment variables. Never commit them, never log them, never send them to the client.
2. All third-party access tokens (LinkedIn, HubSpot, Salesforce, payroll) are encrypted at rest with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`. Decrypt only inside server code at the moment of use.
3. Every table has `organization_id` (except global lookup tables) and RLS policies.
4. All times stored in UTC. Each organization has a `timezone` used for display, challenge windows, and report timing.
5. Money stored as integer cents with a currency code. Payout amounts are immutable once approved; changes require canceling and creating a new payout.
6. Every action on payouts, payroll connections, and CRM connections writes to `audit_log`.

---

## 6. Data model

Starting schema. The coding agent may add indexes, timestamps, and join tables as needed, and records meaningful changes in `PROGRESS.md`. All tables include `id uuid primary key`, `created_at`, and `updated_at` unless noted as append-only.

### Core

**organizations**
`name`, `slug` (unique), `timezone`, `website_url`, `admin_review_required boolean default false`, `disclosure_mode` (natural, prefix_line), `disclosure_text`, `disclosure_locked boolean default true`, `payout_second_approval_threshold_cents` (null means single approval), `stripe_customer_id`, `plan`

**memberships**
`organization_id`, `user_id`, `role` (owner, admin, payroll_approver, teammate, viewer), `status` (invited, active, removed), `opted_in_at`, `work_email`, `job_title`, `department`, `expertise_topics text[]`, `writing_samples text`, `link_slug` (unique per org), `pay_type` (unknown, salaried, hourly; optional, used only to show a payroll note to admins)

**invitations**
`organization_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at`, `invited_by`

**company_context_docs**
`organization_id`, `title`, `type` (pasted_text, file), `content_text`, `storage_path`, `char_count`, `is_active boolean`

**brand_settings** (one row per org)
`organization_id`, `voice_description`, `topics_to_emphasize text[]`, `topics_to_avoid text[]`, `blocked_phrases text[]`, `competitors_to_never_name text[]`

### Content

**social_accounts**
`organization_id`, `user_id`, `provider` (linkedin), `provider_account_id`, `display_name`, `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `scopes text[]`, `can_post boolean`, `can_read_analytics boolean`, `status` (connected, expired, revoked, error), `last_error`

**interviews**
`organization_id`, `user_id`, `status` (in_progress, completed, abandoned), `focus`, `idea_id`, `completed_at`

**interview_messages**
`interview_id`, `organization_id`, `role` (assistant, user), `content`, `sequence int`

**drafts**
`organization_id`, `user_id`, `interview_id`, `idea_id`, `provider`, `body`, `status` (draft, in_review, changes_requested, approved, scheduled, publishing, published, failed, archived), `tracked_link_id`, `has_employment_disclosure boolean`, `guardrail_warnings jsonb`, `guardrail_check_ran boolean`, `prompt_version`, `scheduled_for`, `published_at`, `published_url`, `provider_post_id`, `publish_method` (manual, api), `approved_at`, `review_note`, `attempt_count`, `last_error`, `disqualified_from_challenges boolean default false`, `disqualified_reason`, `disqualified_by`

**post_metric_snapshots** (append-only)
`organization_id`, `draft_id`, `user_id`, `provider`, `provider_post_id`, `impressions`, `members_reached`, `reactions`, `comments`, `reposts`, `captured_at`

**ideas**
`organization_id` (null for global curated ideas), `title`, `prompt`, `audience_roles text[]`, `source` (curated, ai_generated, admin), `is_active`

### Attribution

**campaigns**
`organization_id`, `name`, `destination_url`, `utm_campaign`, `is_default`, `is_active`

**tracked_links**
`organization_id`, `user_id`, `campaign_id`, `draft_id`, `slug` (globally unique, 7 random URL-safe characters)

**link_clicks** (append-only)
`organization_id`, `tracked_link_id`, `user_id`, `clicked_at`, `visitor_hash`, `user_agent`, `referrer`, `country`, `is_bot`, `is_duplicate`

**conversions** (append-only except `status`)
`organization_id`, `click_id`, `tracked_link_id`, `user_id` (attributed teammate), `type` (lead, demo_booked, opportunity_created, deal_won, signup, custom), `value_cents`, `currency`, `external_id` (unique per org), `occurred_at`, `source` (webhook, snippet, crm), `crm_connection_id`, `crm_object_type`, `crm_object_id`, `status` (active, reversed)

**api_keys**
`organization_id`, `name`, `key_prefix`, `key_hash`, `last_used_at`, `revoked_at`

**crm_connections**
`organization_id`, `provider` (hubspot, salesforce), `account_identifier`, `instance_url`, `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `status`, `last_synced_at`, `sync_cursor jsonb`, `settings jsonb`, `connected_by`

**crm_stage_mappings**
`organization_id`, `crm_connection_id`, `conversion_type`, `crm_object` (contact, lead, opportunity, deal), `crm_field`, `crm_value`, `use_amount boolean`

### Rewards

**challenges**
`organization_id`, `name`, `description`, `rules_text`, `metric` (leads, impressions, unique_clicks, published_posts, deal_value), `starts_at`, `ends_at`, `settling_hours int default 72`, `reward_type` (none, cash_bonus, pto, gift, custom), `reward_description`, `reward_amount_cents` (nullable), `currency`, `winner_count int default 1`, `eligible_scope` (all_opted_in, departments), `eligible_departments text[]`, `status` (draft, scheduled, active, settling, ended, canceled), `created_by`

**challenge_results** (written when a challenge ends)
`organization_id`, `challenge_id`, `user_id`, `rank`, `score numeric`, `reached_score_at`, `is_winner boolean`

**reward_payouts**
`organization_id`, `challenge_id`, `user_id`, `amount_cents`, `currency`, `reward_type`, `status` (pending_approval, awaiting_second_approval, approved, exported, sent_to_payroll, paid, canceled), `first_approved_by`, `first_approved_at`, `second_approved_by`, `second_approved_at`, `payroll_connection_id`, `payroll_employee_link_id`, `provider_reference`, `exported_at`, `sent_at`, `paid_at`, `canceled_by`, `cancel_reason`, `notes`

**payroll_connections**
`organization_id`, `provider` (export_only, gusto), `status`, `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `provider_company_id`, `payroll_contact_email`, `connected_by`

**payroll_employee_links**
`organization_id`, `payroll_connection_id`, `user_id`, `provider_employee_id`, `match_method` (work_email, manual), `confirmed_by`, `confirmed_at`

### System

**reports**
`organization_id`, `period_start`, `period_end`, `sent_at`, `recipient_count`, `payload jsonb`

**jobs**
`type`, `payload jsonb`, `run_at`, `status` (pending, running, done, failed), `attempts`, `last_error`, `locked_at`

**audit_log** (append-only)
`organization_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `metadata jsonb`, `ip_hash`

---

## 7. Feature requirements

Each feature lists requirements and acceptance criteria. Acceptance criteria are what the founder will test.

### F1. Auth, organizations, roles, invites

Requirements:
1. Sign up and sign in with email magic link and Google via Supabase Auth.
2. A new user with no organization goes to "Create your company" (name, website, timezone) and becomes Owner.
3. Admins invite people by email with a role. Invitation links expire after 7 days and are single use.
4. Invitees with an account join on accept. New invitees sign up first, then join.
5. Admins change roles and remove members. Removing a member revokes and deletes their stored social tokens, keeps historical click, conversion, and payout records (shown as "Former teammate" in reports), and hides them from future leaderboards. Pending payouts for a removed member stay visible to approvers and are not auto-canceled.
6. Org switcher for users in more than one org.

Acceptance criteria:
- [ ] I can create an account, create a company, and land on the admin dashboard.
- [ ] I can invite a teammate, they receive an email, accept, and see the teammate experience.
- [ ] A teammate cannot open any admin or payout page by URL, and cannot read another org's data through the API (verified by tests).
- [ ] Removing a member deletes their tokens and hides them from leaderboards, and their pending payout remains visible to approvers.

### F2. Company context, brand settings, employment disclosure

Requirements:
1. Admins add context documents by pasting text or uploading .txt, .md, .pdf, or .docx. Extract text on upload.
2. Total context size meter. Cap active context at 60,000 characters and ask admins to deactivate docs past the cap. No embeddings or retrieval in v1.
3. Empty-state prompts: "What we sell and who buys it," "Recent wins and launches," "Our point of view on the industry," "Things we never say."
4. Brand settings form: voice description, topics to emphasize, topics to avoid, blocked phrases, competitors never to name.
5. Employment disclosure settings. Posts by employees about their employer need to make the employment relationship clear in the post itself. Disclosures are about employment only and never mention rewards, challenges, or bonuses.
   - `natural` mode (default): the draft writer mentions the employment relationship naturally within the first two lines (for example "At Acme, our onboarding team…"). A deterministic check confirms the company name appears in the first 220 characters in a first-person employment context ("at {company}," "I work at," "our team at," "we at"). If the check fails, the app prepends the disclosure line.
   - `prefix_line` mode: the app always places `disclosure_text` as the first line. Default text: "I work at {company}."
   - `disclosure_locked` (default true) prevents teammates from removing the disclosure.
   - Settings page shows: "Your legal team should approve this wording." Link to a help article placeholder.

Acceptance criteria:
- [ ] I can upload a PDF and see its extracted text.
- [ ] Brand settings are visibly used in the next generated drafts.
- [ ] With disclosure locked, I cannot approve a post that lacks an employment mention in the first two lines.
- [ ] No generated or appended disclosure ever mentions a reward, bonus, or challenge (covered by a test).

### F3. Teammate profile and opt-in consent

Requirements:
1. First visit consent screen in plain language: participation is optional; nothing posts without their approval; what data Crewcast stores (drafts, link clicks, attributed leads from the company CRM, post performance once connected, and reward history); posts mention that they work at the company; rewards, if the company offers them, are paid through company payroll and are taxable like other pay; they can leave anytime. "Join the program" stores `opted_in_at`.
2. Profile setup: job title, department, 3 to 5 expertise topics, optional writing samples, work email (prefilled from invite, used to match payroll records).
3. Unique `link_slug` from their name, editable once.
4. "Leave the program" clears opt-in, deletes tokens, removes them from active leaderboards. Already-earned payouts are unaffected.

Acceptance criteria:
- [ ] A teammate cannot reach interviews or drafts before opting in.
- [ ] Leaving the program works immediately and does not cancel earned payouts.

### F4. AI interview (text chat)

Requirements:
1. Start from dashboard, optionally choosing an idea or focus. Target about 5 to 10 minutes.
2. Chat UI with streaming responses. One question at a time.
3. Uses teammate profile, active company context, and brand settings. Follow-ups pull concrete specifics.
4. Maximum 8 questions. "I'm done, write my posts" available after 3 answers.
5. Never asks for confidential information. Asks permission before using any customer or partner name and records the answer.
6. Auto-saves. Resumable for 7 days, then abandoned.
7. Prompts live in `/src/lib/ai/prompts/` as versioned files (Section 8).

Acceptance criteria:
- [ ] Questions clearly reflect my role and our company context.
- [ ] Refreshing mid-interview keeps progress.
- [ ] Ending early after 3 answers generates drafts.

### F5. Draft generation, editing, and approval

Requirements:
1. On interview completion, generate 3 LinkedIn drafts with different angles, shown as cards.
2. Drafts use only facts from the transcript and context. Model returns `claims_to_verify`, shown as a checklist above the editor.
3. Editor: plain text, live character count against LinkedIn's limit (3,000 at time of writing, stored as a config constant, verify), quick actions (Shorter, Punchier, More personal, Fix grammar), Regenerate.
4. "Add my link" picks an active campaign, creates or reuses the teammate's tracked link, inserts the short URL. Drafts without links get a nudge, not a block.
5. Employment disclosure enforced per F2 on every draft, regardless of whether any challenge is active.
6. Guardrail check on Approve (F15). Blocked phrases block approval. Other warnings allow approval.
7. Approval flow: with admin review off, teammate approves. With admin review on, teammate submits, admin approves or requests changes, teammate gives final approval.
8. Drafts untouched for 30 days are archived.

Acceptance criteria:
- [ ] Completing an interview produces 3 distinct drafts in under 30 seconds in normal conditions.
- [ ] An approved draft never contains a blocked phrase and always passes the disclosure check when locked.
- [ ] An admin cannot give final approval on a teammate's behalf.
- [ ] Inserting my link adds a working short URL.

### F6. Manual publishing mode

Lets the product work before LinkedIn API access is approved.

Requirements:
1. "Post on LinkedIn" copies text to clipboard and opens LinkedIn's composer in a new tab.
2. Draft moves to "Waiting for your post link." Teammate pastes the LinkedIn post URL (validated). Status becomes `published`, `publish_method` is `manual`. Extract the post identifier from the URL when possible so analytics can match it later (F13).
3. "I posted it but don't have the link" marks published without URL, flagged unverified. Unverified posts do not count toward any challenge metric.

Acceptance criteria:
- [ ] I can go from approval to published without any LinkedIn API connection.
- [ ] Unverified posts are excluded from challenge scoring (test).

### F7. Trackable links, click logging, snippet and webhook conversions

Requirements:
1. Admins manage campaigns (name, destination URL, UTM campaign, default flag).
2. Short link format: `{APP_URL}/l/{slug}`.
3. Redirect route, target under 150 ms server time:
   - 404 page if link missing or campaign inactive.
   - Known crawler user agents (including LinkedIn's link preview bot, search engines, uptime checkers) set `is_bot`. Bot hits never count.
   - `visitor_hash` is a salted hash of IP and user agent. Never store raw IP.
   - `is_duplicate` if the same visitor clicked the same link in the last 30 minutes.
   - 302 to destination with `utm_source=linkedin`, `utm_medium=employee_advocacy`, `utm_campaign`, `utm_content={link_slug}`, and `cc_click={click_id}`, preserving existing query parameters.
   - If logging fails, still redirect.
   - Rate limit per IP.
   - Nothing about challenges or rewards appears anywhere in the redirect, parameters, or 404 page.
4. JS snippet (`/snippet.js`): reads `cc_click`, stores it in a first-party cookie for 30 days, writes it into hidden form fields named `crewcast_click_id` (so CRM forms capture it, see F14), and exposes `crewcast.track(type, { value, externalId })`.
5. Webhook `POST /api/v1/conversions` with org API key: `click_id` or `link_slug`, `type`, `value_cents`, `currency`, `external_id` (required), `occurred_at`. 201 on create, 200 if duplicate `external_id`.
6. Settings page: snippet with copy button, API keys (create, show once, revoke), "Send test conversion."
7. Attribution: last click within 30 days. Conversions without a click are "Unattributed."

Acceptance criteria:
- [ ] A teammate link redirects with correct UTMs and `cc_click`.
- [ ] A LinkedIn preview crawler hit does not count as a click (test).
- [ ] Two quick clicks from one visitor count once.
- [ ] A test webhook conversion appears attributed within a minute; a duplicate `external_id` creates one record.

### F8. Dashboards

Teammate dashboard:
1. Next action card.
2. My stats this month and all time: published posts, impressions (when available), unique clicks, leads, attributed deal value (when CRM connected), rank in each active challenge.
3. My drafts by status, published posts with clicks and impressions.
4. My rewards: past wins and payout status (Pending approval, Approved, Sent to payroll, Paid).

Admin dashboard:
1. Team totals with period selector: opted-in teammates, participation rate, posts, impressions, unique clicks, conversions by type, attributed deal value.
2. Top posts by impressions and by unique clicks.
3. Team table, sortable and exportable to CSV.
4. Data source health: LinkedIn connections, analytics access, CRM sync status and last sync time.
5. Pending invites and teammates not opted in.

Acceptance criteria:
- [ ] Dashboard numbers match underlying data (tests with seed data).
- [ ] CSV export opens correctly in Excel and Google Sheets.
- [ ] Dashboards load in under 2 seconds with 250 teammates, 100,000 clicks, and 20,000 metric snapshots.

### F9. Private reward challenges and leaderboards

Requirements:
1. Challenges are optional. Admins can run challenges with no reward (bragging rights), or with a reward of any type and any amount they choose.
2. Create challenge: name, description, rules text shown to teammates, metric, start and end in org timezone, settling period (default 72 hours, for late CRM updates and analytics), reward type, reward description, optional amount, number of winners (1 to 10) with an optional amount per rank, and eligibility (all opted-in teammates or selected departments).
3. Metrics:
   - `leads`: conversions of type lead or demo_booked attributed to the teammate, occurring inside the window. Uses CRM data when connected, otherwise snippet and webhook data.
   - `deal_value`: sum of `value_cents` from deal_won conversions inside the window. Requires CRM connection.
   - `impressions`: impressions on the teammate's verified posts published inside the window, measured at the end of the settling period. Requires F13 analytics access. Only selectable when the org has analytics available, and teammates without an analytics-connected account see "Connect LinkedIn to compete."
   - `unique_clicks`: non-bot, non-duplicate clicks inside the window.
   - `published_posts`: verified published posts inside the window.
4. Metric picker explains trade-offs in one line each. For impressions: "Impressions can be inflated by engagement groups. Leads are harder to game when real money is involved." Recommend leads when a cash amount is entered.
5. Leaderboard shows rank, name, avatar, title, score, the viewer's own position even outside the top 10, time remaining, and the reward. Refreshes every 60 seconds.
6. Ties: whoever reached the tied score first ranks higher.
7. Lifecycle job every 15 minutes: scheduled to active, active to settling at `ends_at`, settling to ended after `settling_hours`. On ended: write `challenge_results`, mark winners, create `reward_payouts` in `pending_approval` for any cash reward, notify admins and approvers by email, notify participants in app.
8. Admins can disqualify a post from challenge scoring with a required reason (logged). Scores recompute. Disqualification after a challenge ends requires canceling and recreating payouts.
9. Challenges, leaderboards, and rewards are internal only (Section 4, rule 3). Never include them in generated drafts. The draft writer prompt receives no challenge information.
10. On challenge creation with a cash reward, show an informational note (not legal advice): "Cash rewards are paid through payroll and taxed as wages. For hourly employees, rule-based bonuses may need to be included in overtime calculations. Confirm your plan with HR, payroll, and legal."

Acceptance criteria:
- [ ] I can create a no-reward challenge and a $2,500 cash challenge, generate activity, and see leaderboards update within 60 seconds.
- [ ] A challenge moves through active, settling, and ended at the right local times and names the correct winners.
- [ ] Activity outside the window, bot clicks, and unverified posts are excluded (tests).
- [ ] Impressions metric is not selectable when analytics access is unavailable.
- [ ] Ending a cash challenge creates payouts in pending approval.
- [ ] No draft, redirect, or public page contains challenge or reward information (test scanning generated content and public routes).

### F10. Content ideas library

Requirements:
1. Seed 40 curated global ideas across roles.
2. Admins add company ideas and turn global ideas off.
3. "Suggest ideas for me" generates 5 ideas from profile and context.
4. Any idea starts an interview with that focus.
5. No scraping or reading others' social posts.

Acceptance criteria:
- [ ] Ideas differ by role.
- [ ] Starting from an idea makes the first question about that idea.

### F11. Weekly email report

Requirements:
1. Monday 9:00 AM org local time to admins and viewers, covering the previous Monday to Sunday.
2. Contents: totals with week over week change, participation, top 3 posts, top 5 teammates, active challenge standings, attributed pipeline and deal value when CRM connected, and one rule-based suggestion.
3. Payroll approvers receive a separate short email when payouts await their approval, not the full report.
4. Teammates can opt in to a personal weekly summary.
5. Store sent reports. Unsubscribe link per email type. "Send me a preview now."

Acceptance criteria:
- [ ] Preview renders well in Gmail and Outlook and matches dashboard numbers.

### F12. LinkedIn connection, direct posting, scheduling

Prerequisite: founder has a LinkedIn developer app with posting access.

Requirements:
1. Before coding, check LinkedIn's current docs for Sign In with LinkedIn using OpenID Connect, Share on LinkedIn, `w_member_social`, the Posts API, version headers, and token lifetimes. Record doc version.
2. Three-legged OAuth. Store encrypted tokens, expiry, scopes, member ID, display name. Set `can_post` from granted scopes.
3. Connection health. Email 7 days before expiry. Expired connections fall back to manual mode.
4. "Post now" and "Schedule" with suggested weekday morning times in the teammate's timezone.
5. Cron every 5 minutes publishes due drafts with row locking so nothing posts twice.
6. Retry transient failures up to 3 times with backoff, then `failed` with a plain-language email and a manual posting option.
7. Respect rate limits. Never post anything not approved by the account owner.
8. Disconnect revokes and deletes tokens.

Acceptance criteria:
- [ ] I can connect LinkedIn, post now, and see the post live.
- [ ] A scheduled post publishes within 5 minutes of its time, exactly once.
- [ ] Revoked access produces a clear reconnect prompt.

### F13. LinkedIn post analytics (impressions)

Prerequisite: LinkedIn grants the app access to member post analytics. This requires LinkedIn approval that the founder applies for. Build behind a feature flag (`LINKEDIN_ANALYTICS_ENABLED`) so everything else ships without it.

Requirements:
1. Check LinkedIn's current documentation for the member post analytics API and required scope before implementing. Record doc version.
2. When enabled, the connect flow requests the analytics scope. Set `can_read_analytics` from granted scopes. Existing connections see "Reconnect to share post performance."
3. Daily job (and hourly for posts published in the last 72 hours) fetches metrics for each verified published post owned by an analytics-connected teammate, whether published via API or matched from a manual post URL. Store as `post_metric_snapshots`.
4. Challenge impressions use the latest snapshot captured on or before the end of the settling period.
5. Handle missing data gracefully: posts that cannot be matched show "Performance unavailable," and never count as zero for a teammate who couldn't be measured without clearly telling them why.
6. Org setting shows analytics availability and coverage: "18 of 24 teammates share post performance."

Acceptance criteria:
- [ ] With the flag off, no analytics UI appears and impressions challenges cannot be created.
- [ ] With the flag on and a connected account, a published post shows impressions within 24 hours.
- [ ] Impressions challenge scores match stored snapshots at settling end (test).

### F14. CRM sync: HubSpot and Salesforce

Goal: leads, opportunities, and closed deals from the company's CRM are attributed to the teammate who drove them, and power leaderboards and reports.

Requirements:
1. Provider interface (`src/lib/crm/`) with HubSpot and Salesforce implementations. Check each provider's current API docs, OAuth scopes, webhook or change notification options, and rate limits before building. Record doc versions.
2. Admin connects the CRM via OAuth. One CRM connection per org.
3. Setup wizard:
   - Creates custom fields on contacts (and leads in Salesforce): `crewcast_click_id`, `crewcast_teammate`, `crewcast_first_touch_at`. Explain what each is for. If the admin declines automatic creation, show exact manual setup steps.
   - Shows how to add `crewcast_click_id` as a hidden field on their website forms (the snippet fills it, F7). Includes a "Check my form" test that submits a test lead and confirms it arrived in the CRM with the click ID.
   - Stage mapping: admin maps Crewcast conversion types to CRM states, for example "lead = contact created with a click ID," "demo_booked = lifecycle stage is Sales Qualified Lead," "opportunity_created = deal created," "deal_won = deal stage Closed Won, use amount."
4. Sync:
   - Use webhooks or change notifications where the provider supports them for the objects needed, with a scheduled incremental sync every 15 minutes as a safety net. Store cursors in `sync_cursor`.
   - For each contact or lead with `crewcast_click_id`, resolve the click, attribute to the link owner, and create conversions per the mapping. For deals and opportunities, attribute through the associated contact.
   - `external_id` format: `{provider}:{object_type}:{object_id}:{conversion_type}` for idempotency.
   - If a deal moves out of Closed Won, set the conversion `status` to `reversed`. Reversed conversions stop counting for active challenges and are flagged for approvers if a payout depends on them.
   - Optional write-back (default on): set `crewcast_teammate` on the contact so the sales team sees who sourced the lead.
5. Data minimization: store CRM object IDs, types, stages, amounts, and timestamps only. Do not store contact names, emails, or phone numbers.
6. Health: last sync time, errors in plain language, reconnect prompt on auth failure. Sync failures email admins after 3 consecutive failures.
7. When a CRM is connected, snippet and webhook conversions still work, and duplicates across sources are avoided by preferring CRM records when both reference the same click and type within 24 hours.

Acceptance criteria:
- [ ] In a HubSpot developer test account, a form submission from a teammate link creates an attributed lead in Crewcast within 15 minutes.
- [ ] Closing a deal in the test CRM creates a deal_won conversion with the correct amount; reopening it reverses the conversion.
- [ ] Same flow works in a Salesforce developer org.
- [ ] Syncing the same records twice creates no duplicates (test).
- [ ] No contact PII is stored in Crewcast's database (test inspecting stored records).

### F15. Admin guardrails and audit log

Requirements:
1. Deterministic check: blocked phrases and competitor names block approval.
2. Disclosure check per F2 blocks approval when locked.
3. AI check (parallel, 10 second timeout, fails open with `guardrail_check_ran = false`): confidential information, unverified numeric claims, unapproved customer names, avoided topics, and any mention of internal rewards, bonuses, or challenges. Warnings only.
4. Admin review toggle and disclosure lock.
5. Audit log (M7) for approvals, reviews, publishes, role changes, guardrail overrides, disqualifications, CRM and payroll connections, and every payout action. Admin page to filter and export it.

Acceptance criteria:
- [ ] Adding a blocked phrase immediately blocks approval of drafts containing it.
- [ ] If the AI check fails, approval still works and the draft records that the check did not run.
- [ ] Every payout state change appears in the audit log with actor and timestamp.

### F16. Billing, monitoring, hardening

Requirements:
1. Stripe Billing plans matching the landing page (Starter, Growth), prices in env vars. Enterprise handled manually.
2. Billable seat: opted-in membership that has published at least once or connected an account. Sync quantity to Stripe daily.
3. 14 day trial, no card. Expired trial makes the org read-only, but payout approvals and exports for already-ended challenges keep working.
4. Plan feature gating in one config map (see open questions for which plans get CRM sync and payouts).
5. Sentry. Structured logs without secrets, personal content, or payout amounts tied to names.
6. Security checklist (Section 11) fully passing before M8 begins.

Acceptance criteria:
- [ ] Test mode checkout upgrades the org and seat count syncs.
- [ ] Expired trial is read-only except pending payout actions.

### F17. Reward payouts: approval workflow and payroll export

Crewcast records, approves, and hands off payouts. It never moves money.

Requirements:
1. Payouts are created only by an ended challenge (F9) or manually by an Owner with a required reason (for corrections). Teammates and Admins cannot edit amounts.
2. Approval:
   - An Admin gives first approval. If the amount is at or above `payout_second_approval_threshold_cents`, a different user with Owner or Payroll approver role gives second approval.
   - Approval screen shows the challenge, rules text, final leaderboard, the winner's score with its underlying records (posts, conversions, and any reversed or disqualified items), and the settling timestamp.
   - Approvers can cancel with a reason, which lets an Admin rerun scoring and regenerate payouts.
3. Teammate is notified when their payout is approved, sent to payroll, and marked paid. Notifications say "Your reward will be paid through payroll" and never show other teammates' payouts.
4. Export: Payroll approver selects approved payouts and downloads a CSV. Provide a generic format (employee name, work email, payroll employee ID if linked, amount, currency, earning type "Bonus," memo with challenge name and period) plus column presets for common providers where the founder confirms the format. Exported payouts move to `exported`.
5. "Email export to payroll contact" sends the file to `payroll_contact_email` as an expiring secure download link, not an attachment.
6. Approver marks exported payouts as `paid` with a pay date.
7. Payroll page lists payouts by status, filterable by challenge and period, with CSV export for accounting.
8. No card numbers, bank details, SSNs, or tax IDs are ever collected or stored by Crewcast.

Acceptance criteria:
- [ ] A $2,500 winner flows through first approval, second approval (threshold set to $1,000), export, and marked paid, with each step in the audit log.
- [ ] The same person cannot give both approvals (test).
- [ ] An Admin cannot change an approved amount (test).
- [ ] The teammate sees only their own payout and its status.
- [ ] Reversing a deal that a pending payout depends on flags the payout for review.

### F18. Reward payouts: payroll provider sync

Prerequisites: F17 complete and in use by at least one design partner. Founder has applied for and received production API access from the payroll provider. Gusto first. Gusto production access requires partner approval and a security review, so the founder applies before this milestone starts.

Requirements:
1. Payroll provider interface (`src/lib/payroll/`) with an `export_only` adapter (F17) and a Gusto adapter. Check Gusto's current API docs for company and employee access, off-cycle or bonus payroll creation, required scopes, and approval rules before building. Record doc version.
2. Owner connects Gusto via OAuth. Crewcast requests only the scopes needed to read employees and create a bonus payroll draft.
3. Employee matching: match opted-in teammates to payroll employees by work email. Show matches, mismatches, and unmatched people. An Owner or Payroll approver confirms matches. Unmatched teammates' payouts stay export-only.
4. "Send to payroll": for approved payouts with confirmed matches, create a bonus payroll or bonus earning entry in the provider as an unsubmitted draft. Crewcast never submits, approves, or funds a payroll run. The payroll admin reviews and submits it inside the payroll provider.
5. Store the provider reference, set status `sent_to_payroll`, and link the approver to the draft in the provider.
6. Sync status back: a daily job checks whether the provider payroll containing the payout was processed, and sets `paid` with the pay date. If the provider draft is deleted, return the payout to `approved` and notify the approver.
7. Errors are shown in plain language with a fallback to CSV export.
8. Disconnecting payroll deletes tokens and leaves payout history intact.

Acceptance criteria:
- [ ] In Gusto's demo environment, sending an approved payout creates an unsubmitted bonus payroll draft for the correct employee and amount.
- [ ] Crewcast cannot submit the payroll (no code path calls a submit endpoint, verified by test and code review).
- [ ] Processing the payroll in the demo environment marks the payout paid within a day.
- [ ] Unmatched employees fall back to export with a clear message.

---

### F19. Existing calls to private draft suggestions

User-requested addition: ingest conversations employees already have in their day-to-day work using Fathom and other call-recording providers, identify important topics and recurring themes, anonymize company/customer details, and deliver a draft the teammate can post themselves.

**Implementation status:** the current M0 extension is a fictional, local interaction preview. It has no provider connection, live ingestion, semantic theme extraction, AI drafting, database writes, or server-side approval. Its known-string masking is not a production anonymization engine.

#### Experience

1. A signed-in, opted-in teammate authorizes a recorder connection. Fathom first; Required provider coverage: Granola, Fathom, Fireflies, Circleback, Read AI, Otter.ai, Zoom, and Avoma. Each uses a provider adapter feeding the same transcript → privacy → themes → draft → author-review pipeline. Fathom is first to implement; the other seven are required follow-ons, not optional suggestions. No new meeting bot, audio recording, or transcription service is required: reuse available text transcripts.
2. The teammate chooses eligible call types and which existing calls to include. Automated suggestions from future eligible calls are opt-in, with pause/disconnect controls. Default to the teammate's own calls; do not import everything shared with an organization merely because an API can access it.
3. A private call inbox shows processing state and excluded/failed calls without exposing transcript content in notifications. Existing recording access is not by itself permission to repurpose a conversation for public content. Require a company-approved repurposing policy and teammate authorization; allow exclusion before AI processing.
4. Exclude HR, legal, medical, compensation, credential/security, and explicitly confidential conversations by default. Unknown eligibility and failed privacy checks stay held for review, not silently approved. Exclusion rules cannot guarantee detection; the user retains control over included calls.
5. Identify themes such as repeated customer questions, practical lessons, workflow friction, and the teammate's own observations. Rank by relevance, supported recurrence, specificity, and usefulness to the intended audience. Explain why each suggestion was selected; do not equate a frequent topic with an approved public claim.
6. Show evidence attached to each theme: eligible source call, timestamp, and redacted excerpt. Distinguish customer speech from the teammate's own experience. Do not turn another person's story into the teammate's claimed achievement. One-call ideas must not be labeled recurring themes.
7. Present a draft with editable text, fact review, privacy review, and the existing employment disclosure/guardrails. Reuse M2 approvals, including any required admin review, followed by the teammate's final approval. Every edit invalidates final approval. The live draft is private to the author under the same limited admin-review rules as F5.
8. Start with LinkedIn-style text and manual copy/post, compatible with the existing LinkedIn-first plan. Copyable text can be adapted by its author elsewhere; additional platform-specific formatting or direct posting integrations are not implicitly included.

#### Anonymization and source integrity

- Remove or generalize customer/company names, people, contact information, domains/links, commercial figures, deal terms, unreleased product names, launch dates, and direct quotes that could expose the speaker.
- Also assess combinations of indirect clues (industry, location, team size, event timing, distinctive problems). Removing names is not a guarantee of anonymity. If the substance remains identifying or confidential after redaction, do not suggest a post from it.
- Keep the author's employer disclosure from F2, while omitting confidential employer information. If anonymity requirements would conflict with the mandatory employment disclosure, hold the draft for policy resolution rather than silently deleting the disclosure.
- Process raw transcripts only in the authorized server environment. Provide the drafting model only minimized, redacted, approved excerpts and the existing permitted profile/context fields. Entity detection, contextual privacy assessment, and a final output scan are required before live use; regex substitutions alone do not meet this criterion.
- Maintain evidence references separately from draft text. Never insert recording URLs, participant emails, or private source metadata into a public post. Do not invent outcomes, numeric claims, customer permission, or personal experience. Insufficient evidence means no draft or a follow-up question.
- Treat transcripts as untrusted data, including text that resembles instructions to the model. They cannot modify system rules, invoke tools, retrieve unrelated records, or override privacy restrictions.
- The user reviews the exact final version. Privacy checks fail closed when unavailable. No auto-publishing, approval by an admin on the teammate's behalf, or silent sharing of raw transcripts.

#### Connector and data boundary

- Implement provider adapters with normalized segments (stable recording ID, speaker reference, timestamp, text); no provider-specific data shape in the draft UI. Fathom's response parser is scaffolded, but is not a live adapter and does not anonymize segment text.
- For public Fathom integration, use OAuth with provider-approved scopes. Keep credentials encrypted server-side. Register narrowly scoped webhooks, verify signatures against raw bodies with timestamp tolerance, and deduplicate events. Use paginated, bounded backfill with explicit date/call selection and safe retries.
- Enforce organization, connection ownership, meeting eligibility, and author permissions on every job/read/write. Never trust a webhook-supplied tenant or user ID without resolving the authenticated connection.
- Do not fetch video/audio, contact records, or CRM matches for this feature. Filter/strip unused contact metadata from provider responses. Do not log transcript text, titles with customer identifiers, AI outputs, tokens, or raw validation errors.
- Keep raw transcripts ephemeral where possible. Set and review explicit retention before production; do not silently retain complete customer-call archives. Deletion/disconnection must stop jobs and remove raw material and unneeded excerpts according to policy; account revocation must stop future access.
- Proposed entities: recorder connections, call import records, redacted source segments, themes with evidence references, and draft source links. Exact schema, retention periods, encryption, and RLS policies remain part of M1/M2a design review; no schema migration has been made in M0.

#### Required provider coverage and access differences

The provider catalog and internal intake contract include all eight requested tools. Catalog entries describe verified provider capabilities, not live connections. No source becomes “Connected” or “Supported live” until its own authenticated end-to-end test passes.

| Provider | Native ingestion plan | Access considerations / fallback | Official reference |
|---|---|---|---|
| Granola | Transcript REST API and signed webhooks | Business/Enterprise API access, note scopes, paginated transcript completeness. Do not substitute AI notes for a verbatim transcript. | [Granola API](https://docs.granola.ai/help-center/sharing/integrations/granola-api) |
| Fathom | OAuth for customer-facing app, transcript retrieval and webhooks | Per-user authorization and narrow meeting eligibility. | [Fathom OAuth](https://developers.fathom.ai/oauth) |
| Fireflies | GraphQL transcript query; transcript-ready webhook | API-authorized records only; webhook ownership does not replace Crewcast content eligibility. | [Fireflies transcript query](https://docs.fireflies.ai/graphql-api/query/transcript) |
| Circleback | REST meeting transcript endpoint | API key and authorized meeting access; verify event delivery before choosing polling vs webhook. | [Circleback API](https://circleback.ai/docs/api) |
| Read AI | REST API / OAuth, bounded polling of completed meetings | API currently documented as beta; workspace downloads enabled; rotating refresh tokens. Do not assume example API-key-shaped tokens mean static API keys are supported. | [Read AI access](https://support.read.ai/hc/en-us/articles/49379985941523-Read-AI-API-and-MCP-Overview) |
| Otter.ai | Public API and workspace webhooks | Enterprise API access. Authorized TXT/SRT transcript export is the fallback for accounts without native API access. | [Otter API](https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API), [exports](https://help.otter.ai/hc/en-us/articles/360047733634-Export-conversations) |
| Zoom | Cloud recording transcript retrieval and transcript-completion event | Recording permission plus an available generated transcript. VTT export fallback. Local audio-only recordings do not imply a transcript exists. | [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/) |
| Avoma | Transcript API; provider events where available | API-enabled plan, admin-managed scoped credentials. Verify native response contract and event types before implementation. | [Avoma API setup](https://help.avoma.com/api-documentation) |

Implementation requirements shared by all eight:
- Normalize speaker references, transcript segments and timestamps; missing speakers/timestamps remain explicitly unknown. Preserve sourceKind (notes vs transcript) and complete/incomplete state. Missing transcript access is an actionable state, not an empty successful import.
- Persist an import uniqueness constraint scoped to organization + recorder connection + provider + external call ID. Source-version changes must trigger reprocessing and invalidate dependent review where appropriate.
- When one meeting appears through multiple recorders (for example Zoom and Fathom), prevent duplicate topic weighting using verified meeting provenance or user confirmation. Do not deduplicate solely by title or collapse unrelated calls. This cross-provider meeting resolver is still to be implemented.
- Build one privacy/theme/draft pipeline and provider-specific acquisition adapters; do not maintain eight separate prompt/approval implementations.
- Offer authorized transcript-file ingestion when native account access is unavailable. Validate TXT/SRT/VTT limits and syntax, preserve uncertainty and provenance, never scrape recorder UIs or accept arbitrary private download URLs. File ingestion is planned, not enabled in the public demo.
- Show clear states: planned, authorization required, connected, transcript unavailable, paused, sync failed, and export required. Provider documentation links are informational; they do not grant access.
- Contract tests and common-pipeline fixtures are necessary but are not evidence of a working native connection. Each connector needs a real authorized sandbox/test meeting through ingestion, redaction, drafting, and personal approval before acceptance.

#### Acceptance criteria for the live feature (not met by sample UI)

- [ ] A real authorized Fathom test call arrives exactly once and becomes available only to its permitted organization and author.
- [ ] Excluded calls are not sent to AI, and paused/disconnected integrations stop processing.
- [ ] Backfill respects chosen date range, pagination, ownership and permissions; retries do not create duplicate calls/drafts.
- [ ] Invalid/expired webhook signatures and cross-organization access are rejected by tests.
- [ ] Themes reference actual transcript segments; unsupported recurrence and fabricated claims are rejected.
- [ ] Known entities, commercial/roadmap details, contact data, and indirect identifiers are tested across anonymization input and output. Failures block the draft.
- [ ] The drafting request contains only approved redacted excerpts and approved context, never raw transcript or participant metadata.
- [ ] Prompt-injection fixtures cannot override content or privacy rules.
- [ ] The teammate receives a private suggestion, edits, reviews, and approves the exact version before copying/posting. Editing revokes approval server-side.
- [ ] Retention/deletion, connection revocation, and graceful rate-limit/AI failure handling are tested.
- [ ] All eight provider adapters require their own native payload contract, auth, and end-to-end tests before being presented as connected providers.

Official provider references checked September 17, 2026: [Fathom OAuth](https://developers.fathom.ai/oauth), [Fathom webhooks](https://developers.fathom.ai/webhooks), [Fathom transcript API](https://developers.fathom.ai/api-reference/recordings/get-transcript), [Fathom meeting pagination](https://developers.fathom.ai/api-reference/meetings/list-meetings), [Fireflies webhooks](https://docs.fireflies.ai/graphql-api/webhooks), and [Gong transcript API](https://help.gong.io/apidocs/retrieve-transcripts-of-calls-by-date-or-callids-v2callstranscript-2). Recheck scopes, access/plan availability, and rate limits before live implementation.

---

## 8. AI behavior specifications

All AI calls go through one module (`/src/lib/ai/`) that handles the client, model name from env, timeouts, retries on overload errors, token usage logging (counts only, no content), and Zod validation of structured output. Invalid output retries once with the validation error, then shows a friendly error. Prompts are versioned files, and the prompt version is stored on drafts.

The AI never receives challenge, reward, payout, or CRM contact data. It receives only company context, brand settings, the teammate's profile, the interview or authorized redacted call excerpts (F19), and the draft. Raw call transcripts, participant contact details, recording links, and provider credentials are excluded from the drafting input.

### 8.1 Interviewer

Inputs: teammate profile, company context, brand settings, optional idea, transcript.

Behavior: warm, curious, concise. One question at a time, under 40 words. Opens with a specific question tied to role or idea. Follows up for specifics (a moment, a number, a before and after, a mistake, a lesson, an opinion). Never invents facts. Avoids confidential information. Asks permission before using any customer or partner name. Stops after 8 questions or when it has enough for 3 strong posts.

### 8.2 Draft writer

Inputs: transcript, profile and writing samples, company context, brand settings, company name, disclosure mode, provider constraints.

Output (JSON, validated):
```json
{
  "drafts": [
    {
      "angle": "story | lesson | opinion | how_to | behind_the_scenes",
      "body": "string, first person, within the character limit",
      "employment_mention": "string, the exact phrase in the first two lines that shows the writer works at the company",
      "suggested_link_line": "string or null",
      "claims_to_verify": ["string"],
      "topics": ["string"]
    }
  ]
}
```

Rules: exactly 3 drafts with different angles. Teammate's voice, first person, short paragraphs, strong first line, ends with a question or takeaway. In `natural` disclosure mode, the first two lines must make clear the writer works at the company, naturally. Only facts from the transcript or context. Max 3 hashtags, no emoji unless writing samples use them. No customer names without recorded approval. Never mention internal rewards, bonuses, contests, or leaderboards.

### 8.3 Quick actions

Shorter, Punchier, More personal, Fix grammar. Return only the revised body. Preserve facts, links, and the employment mention in the first two lines.

### 8.4 Guardrail reviewer

Output: `{ "warnings": [{ "type": "confidential | unverified_claim | unapproved_name | avoided_topic | internal_program_mention | tone", "excerpt": "string", "explanation": "string" }] }`

### 8.5 Idea generator

Output: 5 ideas, each with `title` (under 70 characters) and `interview_prompt`.

---

## 9. Design direction

Match the approved landing page (`/design/crewcast-landing.html`) for type, color, spacing, and tone. The landing page copy matches this PRD: employment disclosure only, rewards private.

- Clean, spacious layouts in the style of a premium consumer tech brand. Large, tight headlines, generous whitespace, few borders.
- Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`, Inter as web font fallback.
- Light mode colors: text `#1d1d1f`, secondary `#6e6e73`, background `#ffffff`, alternate background `#f5f5f7`, primary action `#0071e3`, links `#0066cc`, success `#1f9d55`. Accent gradient `#2997ff`, `#a259ff`, `#ff375f`, `#ff9f0a`, used sparingly (prize amounts, winners, key numbers).
- Dark mode from the start using the landing page's dark tokens.
- Pill-shaped primary buttons. Large radius cards (20 to 28px), no heavy shadows.
- Payout and payroll screens are the exception to playfulness: calm, precise, no gradient, amounts in tabular figures, every destructive or money-related action has a confirmation step stating exactly what will happen.
- Copy: plain, active, sentence case. Buttons say exactly what happens ("Approve payout," "Send to payroll").
- WCAG 2.1 AA, keyboard navigation, visible focus, reduced motion respected.
- Responsive to 375px. Teammate flows must work well on a phone.

---

## 10. Milestones

Each milestone ends with a Vercel preview deploy, passing tests, and an updated `PROGRESS.md`. Stop and wait for founder testing.

| Milestone | Features | Notes |
|---|---|---|
| M0. Foundation | Setup, design tokens, app shell, seed data, CI | Seed a demo org with 12 teammates, drafts, clicks, conversions, a challenge |
| M1. Organizations and context | F1, F2, F3 | |
| M2. Interview to approved post | F4, F5, F6, basic F15 | First version worth showing a design partner |
| M2a. Calls to content | F19 | Fathom first; requires M1 auth/RLS and M2 draft/approval infrastructure. Demo-only preview exists in M0. |
| M3. Attribution | F7, F8 | |
| M4. Motivation loop | F9 (leads, clicks, posts metrics), F10, F11 | Payout records are created but the payout UI arrives in M8 |
| M5. LinkedIn direct posting and analytics | F12, F13 behind flag | Needs LinkedIn developer app; analytics needs separate LinkedIn approval |
| M6. CRM sync | F14, deal_value metric in F9 | Needs HubSpot developer account and Salesforce developer org |
| M7. Business readiness | F15 complete, F16 | External security review before M8 |
| M8. Payout workflow and export | F17 | |
| M9. Payroll sync | F18 | Needs Gusto partner approval |

M0 done when: `npm run dev` works from a fresh clone using README steps, CI runs lint, typecheck, and tests.

---

## 11. Non-functional requirements

Security checklist (must pass before M8):
- [ ] RLS on every table, with tests proving cross-org access is denied and teammates cannot read others' payouts.
- [ ] All third-party tokens encrypted at rest; key only in server env.
- [ ] No secrets, tokens, raw IPs, post content, CRM contact data, or payout details in logs.
- [ ] All inputs and webhooks validated with Zod; CRM webhooks verify provider signatures.
- [ ] API keys stored as hashes, shown once.
- [ ] Rate limiting on auth, redirect, conversion, AI, and payout routes.
- [ ] Cron and job routes require a secret header.
- [ ] Payout approval, export, and send actions require recent authentication (re-auth within the last 15 minutes).
- [ ] Two-approval rule enforced in the database, not only the UI.
- [ ] Dependencies audited, no critical vulnerabilities.
- [ ] External security review completed by a qualified professional.

Privacy:
- Store only what features need. Visitor hash salt rotates monthly.
- No contact PII from CRMs. No bank, tax, or government ID data from anyone.
- Org deletion removes all org data within 30 days, except payout and audit records retained as required for the customer's records (export offered before deletion).
- Teammate removal deletes tokens, drafts, and transcripts, and keeps aggregate counts and payout history.
- Privacy policy and terms pages are placeholders, to be replaced with lawyer-reviewed text.

Performance:
- Redirect under 150 ms p95 server time.
- Dashboards under 2 seconds with seed data from F8.

Reliability:
- Publishing, CRM sync, and payroll sends are idempotent. Nothing posts twice, no conversion duplicates, no payout is sent to payroll twice.
- AI, CRM, and payroll failures degrade gracefully with clear messages and manual fallbacks.

Testing:
- Unit: attribution, bot and duplicate detection, challenge scoring for every metric, settling, tie breaks, reversal handling, disclosure check, guardrail matching, token encryption, approval rules, CRM idempotency.
- End-to-end: sign up and org creation, invite and opt in, interview to approved draft, manual publish, click to conversion, challenge to payout approval to export, CRM test lead (M6), payroll draft creation in demo (M9).

---

## 12. Environment variables

```
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_PRODUCT_NAME=Crewcast
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
RESEND_API_KEY=
EMAIL_FROM=
TOKEN_ENCRYPTION_KEY=
VISITOR_HASH_SALT=
CRON_SECRET=
LINKEDIN_CLIENT_ID=              # M5
LINKEDIN_CLIENT_SECRET=          # M5
LINKEDIN_ANALYTICS_ENABLED=false # M5, true only after LinkedIn approval
HUBSPOT_CLIENT_ID=               # M6
HUBSPOT_CLIENT_SECRET=           # M6
HUBSPOT_WEBHOOK_SECRET=          # M6
SALESFORCE_CLIENT_ID=            # M6
SALESFORCE_CLIENT_SECRET=        # M6
STRIPE_SECRET_KEY=               # M7
STRIPE_WEBHOOK_SECRET=           # M7
STRIPE_PRICE_STARTER_MONTHLY=    # M7
STRIPE_PRICE_STARTER_ANNUAL=     # M7
STRIPE_PRICE_GROWTH_MONTHLY=     # M7
STRIPE_PRICE_GROWTH_ANNUAL=      # M7
SENTRY_DSN=                      # M7
GUSTO_CLIENT_ID=                 # M9
GUSTO_CLIENT_SECRET=             # M9
GUSTO_ENV=demo                   # M9
```

---

## 13. Founder setup checklist (outside the code)

| When | Task |
|---|---|
| Before M0 | GitHub repo, Supabase project, Vercel account, Anthropic API key with spending limit |
| Before M1 | Resend account and verified sending domain |
| Before M4 | Employment lawyer reviews: employment disclosure wording, challenge rules template, whether reward programs need any public mention, teammate consent text |
| Before M4 | Payroll or tax advisor reviews: bonus treatment, overtime implications for hourly employees, state-specific rules |
| Before M5 | LinkedIn Company Page and developer app with Sign In with LinkedIn and Share on LinkedIn. Apply for member post analytics access as early as possible |
| Before M6 | HubSpot developer account with a test account, Salesforce developer org |
| Before M7 | Stripe account with products and prices |
| Before M8 | External security review booked; confirm CSV column formats with 2 or 3 design partners' payroll teams |
| Before M9 | Apply to Gusto's partner program and complete their security review. Start this application during M6, since approval is not guaranteed and takes time |
| Before first paying customer | Lawyer-reviewed terms, privacy policy, and data processing agreement |

---

## 14. Success metrics for design partner pilots

Starting hypotheses to test, not benchmarks.

- Opt-in rate: 40 percent or higher of invited teammates.
- Activation: 60 percent or higher of opted-in teammates publish within 14 days.
- Consistency: 35 percent or higher publish at least 2 posts per month.
- Time to first draft: under 10 minutes.
- Attribution: at least one CRM-attributed lead per design partner within 30 days of CRM connection.
- Reward effect: participation rate during cash challenges vs no-reward periods.
- Payout operations: time from challenge end to payout marked paid, target under 14 days.
- Admin value: weekly report opened by at least one admin each week.

---

## 15. Open questions for the founder

1. Final product name and domain.
2. Which plans include CRM sync and payouts (suggestion to evaluate: CRM sync in Growth, payroll sync in Growth or Enterprise).
3. Default employment disclosure mode and wording, pending legal review.
4. Default second approval threshold for payouts.
5. Which payroll providers after Gusto, based on design partners (for example ADP, Rippling, Paychex, Justworks), and whether a unified payroll API is worth evaluating for write access.
6. Whether non-cash rewards (gift cards, PTO) need tracking beyond a description in v1.
7. Data retention for clicks and metric snapshots (assumption: 24 months) and payout records (assumption: 7 years, confirm with advisor).
8. Free trial length and card requirement (assumption: 14 days, no card).
9. Whether teammates can see the reward amount on leaderboards, or only admins (assumption: visible to all members of the org).
