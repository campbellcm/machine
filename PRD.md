# Crewcast V1 — four tabs

Revision: 4 · September 17, 2026
Owner: Colin Campbell
Status: Implementation in progress. See PROGRESS.md for verified behavior and remaining integrations.

This revision supersedes the previous feature list and milestone plan, following the founder’s request to radically simplify V1. The previous specification is preserved in `docs/archive/PRD-v3.md` for history, not as additional V1 requirements.

## Product and navigation

Help teammates turn everyday expertise into approved social posts, see the results together, and compete for company-defined rewards.

Exactly four primary tabs: **Home, Team, Rewards, AI**. Profile, company settings, invitations, connection setup, and post editing live within these tabs or contextual dialogs. Only **LinkedIn and X** are publishing channels. AI/work tools are sources, not social channels.

## Home

- Company totals across connected accounts: impressions/views, unique clicks, leads, sales, and published posts.
- Preset and custom date ranges, interpreted consistently in the company timezone.
- Team leaderboard with each member’s post count and performance. Default ranking by published posts; allow ranking by other available metrics and show ties honestly.
- Grid feed of published team content: author, channel, publication date, excerpt, original-post link, and available metrics.
- Filter the grid by date range and channel. Date range also controls summary stats and the leaderboard. Label the channel filter’s scope clearly.
- Show last sync and coverage. Missing, stale, or failed analytics must not masquerade as zero.
- Impressions are exposure counts, not deduplicated people across networks. Clicks use deduplicated tracked-link events. Leads are attributed conversion events. Sales are attributed closed-won deals; revenue is a separate value and currencies must not be silently mixed.
- Metric filters use event timestamps; the content feed uses publication dates. Explain the difference in metric help text.

## Team

- Company roster: name, role, connected LinkedIn profile, connected X profile, and connection health.
- Explicit states: not connected, connected, reconnect required, paused, sync failed. Show safe profile metadata and last successful sync.
- Each teammate connects/disconnects their own accounts. Admins invite/remove members and view health; they cannot publish as another member or retrieve credentials.
- Members can view the roster and safe connection metadata. Private drafts and credentials remain private.
- Profile, participation, invitations, and admin company settings are contextual actions here.

## Rewards

- Admins define a title, free-form prize description, scoring metric, date range, eligible members, and competition rules.
- Examples: most impressions this month wins $1,000; most unique clicks wins a Mac mini; most leads wins a two-day Miami vacation.
- Cash, products, trips, time off, and other company-defined prizes are descriptions tracked by Crewcast. The company fulfills prizes outside the app. No payment processing, payroll, purchasing, or travel booking in V1.
- Members see prizes, rules, time remaining, and a leaderboard for each reward’s metric and period.
- Only metrics with usable data can power an active competition. Missing analytics means save a draft or choose another metric, not invent scores.
- Admins can edit draft rewards. Lock scoring rules, dates, eligibility, and prize after activation; record and display cancellation reasons.
- State tie handling in the rules. Proposed default: joint leaders pending recorded admin resolution. Final results wait for a defined sync/settlement window; incomplete data prevents automatic winner selection.
- Track final results and fulfillment status, without moving money.
- Prizes and standings remain private to the company and never enter AI drafting inputs or public posts.

## AI

- One place for source connections, daily drafting preferences, and the member’s draft inbox.
- Source/tool catalog: Claude, ChatGPT, Fathom, Slack, and the selected CRM.
- Users select eligible conversations, calls, Slack channels, or approved CRM business context. Access to a tool does not authorize importing everything within it.
- Claude/ChatGPT are requested as account-connected daily drafting engines, not conversation-history imports. The user connects an account, sets their role and approved business context, and presses Start daily drafts. This enables a recurring task producing multiple post options every day. Proposed default: three options, with delivery time/timezone, pause/resume, and run-now controls.
- Founder approved Crewcast-managed recurring generation through OpenAI and Anthropic APIs. Company-configured server credentials supply API access; personal consumer subscriptions are not connected. Teammates choose the provider, approve context, and start/pause their own schedule. API billing is separate.
- Drafts reflect the person’s role, voice, company context, and recent approved source material. Produce multiple distinct daily post options, with pause/resume and timezone preferences.
- Every draft identifies its source and claims to verify. Insufficient source material produces a request for context, not invented facts.
- Remove confidential company details, customer/personal identifiers, sensitive deal information, and unsupported claims before sending approved excerpts to the drafting model. No raw CRM contacts or reward data in prompts.
- Inbox supports editing, LinkedIn/X selection, channel validation, author approval, and publish/schedule actions. Approval is tied to the exact draft version; edits revoke approval.
- Daily drafting does not authorize automatic publication. The author approves each post.
- Disconnection stops future sync/generation. Retention/deletion rules and sync failures must be visible. Retries cannot duplicate posts or drafts.

## Shared requirements

- Retain sign-in, organizations, invitations, consent, admin/member permissions, tenant isolation, encrypted credentials, and essential audit records.
- Use the existing Crewcast visual language, responsive layouts, keyboard access, and light/dark appearance.
- Separate fictional preview data from real workspace data. Never label a provider connected before successful authorization and sync.
- Verify current official provider APIs, scopes, access requirements, and costs before implementing integrations. Do not scrape as an access fallback.
- Keep the current free Netlify hosting plan. Private company pages require application sign-in. No paid plan/API commitment without founder authorization.
- Replace the Vercel-only scheduling assumption with a verified Netlify-compatible path before enabling daily generation, scheduled publication, or automatic reward finalization.
- Preserve existing migrations; add tested migrations for new storage and permissions. The Team UI must not expose the service-only social token table.

## Deferred from V1

- Other publishing channels.
- Payroll, payout approvals/exports, automatic fulfillment, purchasing, and subscription billing.
- Standalone Ideas, Calls, Content, Campaigns, Audit, and Roadmap tabs. Necessary functions fit inside the four tabs.
- The former requirement to ship eight call recorders and two CRMs in V1. Start with Fathom and one selected CRM.
- Advanced attribution, enterprise reporting, and automatic unreviewed social publication.

## Delivery and acceptance

1. Four-tab experience: Home filters, leaderboard/feed, Team connection states, Rewards creation/standings, and AI source/draft workflow. Sample previews clearly labeled.
2. Live accounts/results: sign-in, LinkedIn/X authorization and publishing, supported analytics sync, tracked clicks, selected CRM lead/sales attribution, and tested company isolation.
3. Rewards: durable admin-created prizes, tested scoring/date boundaries/ties, member-visible standings, finalization, and fulfillment tracking without payments.
4. Daily AI: verified source access, approved/redacted context, scheduled generation, author review, safe publishing, and real-account end-to-end tests.

V1 acceptance path: invite teammate → connect LinkedIn or X → select work context → receive and approve a grounded draft → publish → sync results → see the post on Home → update reward standings. Unavailable access must be disclosed rather than simulated.

## Open founder decisions

- First CRM: HubSpot, Salesforce, or another provider.
- Personal-account integration decision resolved: use Crewcast scheduling with provider APIs.

Until resolved, avoid committing to a paid provider or unsupported connection method.
