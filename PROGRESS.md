# PROGRESS.md

Current milestone: M1 live-workspace implementation, with connected M2–M5 pilot flows.
Status: Local implementation and database tests complete for the flows listed below; real-account verification and substantial roadmap work remain. NOT production-ready or full-PRD complete.

## Completed milestones

None signed off yet. M1 has now started; no live Supabase or provider account was supplied.

## Historical M0 implementation

- Next.js 16.3.5 App Router application, strict TypeScript, Tailwind CSS, composable shadcn-style Button, Radix accessible dialogs, Lucide icons.
- Approved landing-page palette and font stack translated to a responsive workspace, system light/dark mode and session theme toggle.
- Overview, content previews and filters, team search/department filter, six sample idea prompts, read-only settings, and build roadmap.
- Zod-validated deterministic seed: one fictional organization, 12 teammates, 38 posts, 964 click events, 43 conversions, and one no-reward challenge.
- Data-derived reporting with month/all-time selection and reconciliation tests.
- Seven unit tests, desktop/mobile Playwright scenarios with axe audits, GitHub Actions workflow, pinned packages/lockfile, Node runtime guidance, environment example, README.
- Supplied PRD, handoff, instruction files, and unchanged HTML visual reference preserved in this project.

## How to test the current build

Use Node 24 LTS and the README steps. From this directory:

```sh
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open http://localhost:3000/demo.

1. Switch the period from September to all sample activity. Posts change from 24 to 30, unique clicks from 690 to 868, and leads/demo requests from 34 to 42.
2. Open Content, select Drafts (six records), and open a post. Close with Escape. Search for nonexistent text and clear filters.
3. Open Your team and search Sarah; one teammate remains. Filter by department.
4. Open Ideas and expand a prompt. Nothing is sent to AI or stored.
5. Toggle appearance in the top header, inspect mobile layout, and open Settings / Build roadmap.

Automated checks:

```sh
npm run lint
npm run typecheck
npm test
npm run db:seed
npm run build
npx playwright install chromium
npm run test:e2e
```

## Verification evidence

- Lint: passed without warnings after configuration cleanup.
- Type checking: passed.
- Unit tests: 7/7 passed, including a run under Node 24.
- Seed validation: passed.
- Production build: passed.
- Dependency audit after installation: 0 reported vulnerabilities.
- Local development server: HTTP 200 and browser rendering verified; filesystem polling avoids the host's native watcher limit.
- Browser interactions verified through Codex's in-app browser: period totals, content filtering, preview opening, Escape dismissal, no-results search, team search, and prompt expansion.
- Responsive review: light/dark desktop screenshots inspected; 375px overview and settings inspected with no horizontal document overflow. Header theme control and mobile settings link verified.
- Playwright suite: attempted but Chromium was blocked at launch by the host sandbox (macOS MachPortRendezvous permission denial). No assertion results or axe pass claimed. Suite remains available for ordinary local execution and GitHub Actions.
- GitHub Actions: workflow authored; no remote repository was provided, so no hosted CI run exists yet.
- Vercel: no account/project was provided; no remote preview deployed.

## Decisions

- User request is to build the supplied project. Embedded handoff example prompts were treated as reference material, not as independent user commands. The example “don't write code until I confirm” was not treated as a live instruction.
- Follow the PRD's milestone order: build M0 locally before real integrations. PRD instruction to finish each milestone with founder testing remains the handoff boundary.
- M0 uses in-memory fixtures, not a premature production schema. No database tables exist; RLS and migration tests are required when M1 introduces them. No existing authentication was changed and no external service was connected.
- Accounts listed as “before M0” in the handoff are not needed for a local synthetic preview. They remain needed for hosted acceptance and subsequent milestones.
- Sample challenge is no-reward and stays in fixture code. No real challenges, leaderboards, rewards, payout records, or payment actions are exposed.
- Marketing claims such as Autopilot and mirroring viral posts were not implemented; the HTML is visual reference only, consistent with the PRD's scope.
- Dual Admin/Payroll role representation remains unresolved in the PRD (one role per membership versus combined roles). Resolve during M1 schema review, not in M0 fixtures.
- Six example prompts illustrate the shell; the 40-role curated library belongs to M4.
- Node 24 LTS is the recommended runtime. The host default Node 25 is outside Vitest 5's supported engine range; unit tests were rerun on Node 24 successfully.
- Disabled Next.js auto-generation of agent rules to preserve the supplied identical AGENTS.md / CLAUDE.md files.

## Known issues and remaining acceptance work

- This is a functional demo shell, not the working SaaS described by M1–M9. No auth, Supabase, AI, durable edits, publishing, CRM, rewards workflow, or payroll exists.
- Never load real company or personal data into the public demo. Build and test authorization before enabling real data.
- Standalone browser tests and automated accessibility auditing still require a host able to launch Chromium. Manual browser checks do not prove full WCAG compliance.
- Hosted CI, Vercel preview, fresh-clone verification on another machine, and founder review are pending. M0 is not marked fully accepted.
- Some sandboxed file systems may require a development-server restart to pick up edits; the optimized preview is unaffected.
- Theme selection lasts during navigation and resets to the system default on full refresh.

## Call-to-content extension — September 17, 2026

The founder requested turning existing recorded work calls into anonymized draft posts, then explicitly required coverage for **Granola, Fathom, Fireflies, Circleback, Read AI, Otter.ai, Zoom, and Avoma**. This is a user-authorized scope extension to the M0 demo and PRD, not implicit approval of M1–M9 or live access to recordings.

### Built

- New `/demo/calls` screen: all eight planned providers, expandable access requirements and official documentation links; three fictional calls; source selection; redacted excerpts; prepared themes with timestamped evidence; editable prepared drafts; explicit sample review before copying.
- Editing a draft, changing sources, or changing review checkboxes revokes sample review. Copy eligibility is tied to the exact reviewed text and rechecked for known identifiers.
- Known-detail masking for fictional customer/person names, email, amount, project and launch date, with explicit limitations. This is not semantic anonymization and not certified privacy protection.
- Zod-validated shared intake contract for all eight providers. Preserves notes vs transcripts, partial vs complete sources, unknown speakers/timing, and scoped import identity. Parsing is not authorization; database enforcement remains future work.
- Fathom response-shape normalizer based on current official documentation. It strips unused speaker metadata but does not anonymize transcript text. No HTTP client, credentials or webhook endpoint was added.
- PRD revision 3 / F19 / M2a specifies the production workflow, access differences, cross-provider duplication controls, privacy and source-integrity rules, and per-provider acceptance tests. Handoff and README updated.

### Verification

- 30 unit tests pass: original 7 plus 23 for call contracts, masking boundaries, draft revision checks, source evidence, and shared workflow fixtures for all eight providers.
- Lint and production compilation/type checking pass.
- In-app browser: all eight providers present; known details masked in excerpts; copy disabled before review, enabled after both reviews and marking reviewed, disabled again after editing; a reintroduced customer name produces a blocking issue.
- Mobile width checked at 375px with no horizontal document overflow. Provider card wrapping adjusted after visual inspection.
- Standalone Playwright call scenarios added. As before, not claimed passing on this host because Chromium launch is blocked by its sandbox. Unit fixtures do not validate real third-party API connections.

### Decisions and open work

- The user's call-source request supersedes the PRD's original interview-only drafting restriction. Ungrounded generation and automatic publishing remain out of scope.
- All eight user-named providers are required scope; Gong was an earlier suggestion and is not included in the eight-provider implementation catalog.
- Granola API: Business/Enterprise. Otter API: Enterprise; TXT/SRT export is the intended fallback. Read AI: documented beta, downloads permission and rotating OAuth refresh tokens. Zoom: available cloud transcript required. Avoma: API-enabled plan/admin credentials. Exact access is checked at connection time in the future implementation.
- Actual transcript-file ingestion, native transports/adapters, signed webhook delivery, OAuth/token encryption, cross-provider duplicate-meeting resolution, AI theme extraction/drafting, semantic privacy checks, private storage/RLS, notifications and durable approvals are NOT implemented. All provider cards say Planned.
- No real calls, API keys, uploads, recordings, participant details, or external AI requests were used. Live acceptance requires authorized test accounts, M1 authentication/private data isolation, and M2 author approval infrastructure. Keep private data out of this demo.


## Live-workspace build — September 17, 2026

### Authorization and scope

The founder explicitly requested the remaining roadmap and real sign-in/social publishing. This authorizes work beyond the former milestone-by-milestone confirmation boundary, including the specified Supabase, Anthropic, LinkedIn, Resend, and Vercel implementation. No service was actually provisioned, no credentials collected, no messages sent, and no social posts published during development. When asked about Supabase and LinkedIn accounts, the founder answered: **“Not yet—build the setup steps into the app.”** `/setup` implements that request.

Work is on `m1-live-workspace`. This branch includes the connected pilot path rather than claiming any complete milestone. The sample workspace remains separately available at `/demo`. A remote repository, PR review, and hosted CI are still unavailable.

### Implemented

- `/setup` launch instructions and explicit implementation status; root opens setup until Supabase is configured. Demo has a live-setup link.
- Supabase SSR cookie refresh and verified user checks; email magic links, Google sign-in, sign-out, company onboarding, organization switching.
- Nine ordered SQL migrations: companies, memberships, invitations, private drafts/interviews, encrypted social accounts, attribution, audit events, no-reward challenges/results, scheduled jobs, service-only rate buckets.
- PostgreSQL RLS for every table; explicit privileges even under permissive Supabase defaults; only bounded RPC mutations for members; privileged functions unavailable to anonymous/authenticated roles; safe SECURITY DEFINER search paths.
- Owner/admin/teammate/viewer/payroll-approver roles. The schema reserves an additional payroll-approver flag for the PRD’s combined-role case; no payroll permissions or payouts are enabled yet.
- Seven-day single-use invitations bound to the signed-in email; Resend delivery when configured, private link fallback when delivery is unavailable. No email provider was called in development.
- Profile and optional participation consent; leaving or removing a member deletes unpublished drafts, interviews, and social tokens, retaining published history.
- Company context as pasted text, brand voice, blocked phrases, locked prefix employment disclosure, optional admin review. Changed company rules invalidate approvals.
- Private draft editing with optimistic revision checks; admin review followed by author final approval; editing resets approval; copy revalidates the current approval on the server. Manual posting supports validated LinkedIn URLs or explicit unverified status.
- Persisted interviews, 3–8 answers, seven-day resumption; Anthropic SDK integration produces exactly three schema-validated drafts and factual claims to verify. Prompts are versioned, model is environment-configured, and inputs explicitly omit rewards/CRM/system data. Questions are currently guided/static, not streaming AI follow-ups. One validation retry; atomic completion prevents duplicate batches.
- LinkedIn OAuth state bound to user/company with expiry; tokens use AES-256-GCM and authenticated tenant/user context. Personal-profile posting uses the documented UGC endpoint. Scheduling binds to approved revision and rechecks eligibility. Delivery uncertainty locks the post instead of blindly retrying.
- Campaigns, per-draft links, 302 redirects, bot filtering, atomic 30-minute deduplication, monthly salted visitor hashes (no raw IP stored), preserved destination parameters, first-party form attribution capture, hashed server API keys, idempotent conversion endpoint and live all-time totals.
- Browser snippet captures click IDs into hidden form fields; server webhook records conversions. It does **not** implement the PRD’s browser `crewcast.track()` method or link-slug attribution fallback yet.
- 40 curated ideas, private recognition-only challenges for leads, unique clicks, and verified posts; deterministic ties, 72-hour settling, immutable result snapshots and cron lifecycle. Cash rewards disabled.
- Audit viewer, team CSV with formula-injection protection, database-backed rate limits for AI/publishing/conversions/redirect logging, protected cron, and Vercel schedule definition.

### Verification

- 55 tests passed, also rerun successfully under Node 24.21.0; includes actual PostgreSQL behavior through PGlite with simulated Supabase auth roles, not a running Supabase Auth/PostgREST deployment.
- Tests include populated cross-tenant isolation, private drafts/interviews, anonymous denial, token/key access denial, explicit grants under permissive defaults, temporary-table shadowing, consent, author approvals/revisions, replay prevention, invite email binding/single-use, atomic generation, scheduling invalidation, attribution/deduplication, settled challenge scoring, AES-GCM tampering and tenant binding, bounded HTTP request bodies, CSV injection, and mocked LinkedIn transport.
- Type checking, lint, and optimized production build passed. Dependency installation audit reported zero vulnerabilities.
- In-app browser checked setup → sign-in, unavailable sign-in state, and private-route redirect to setup. Setup/login inspected at 375px, no horizontal overflow. No authenticated browser flow claimed: accounts are absent.
- Added setup/private-route Playwright coverage. Full standalone Playwright/axe remains unverified on this sandbox (previous Chromium launch restriction).
- No actual OAuth exchange, email delivery, AI generation, LinkedIn publication, scheduled delivery, or conversion through a hosted Supabase instance has been tested. These are explicit pilot acceptance steps, not completed integrations.

### Important decisions and limitations

- This is **not the rest of the PRD completed**. Missing accounts block live acceptance, and the gaps below also require further engineering. Adding credentials alone does not finish them.
- M1 gaps: PDF/DOCX/text-file extraction and document activation management, profile writing samples/link slug, ownership transfer and full account/org deletion, invitation resumption ergonomics, production auth rate-limit/bot setup, dual-role administration.
- M2 gaps: streaming/contextual AI interviewer, autosave while typing, quick rewrites/regeneration, semantic guardrail warnings, full disclosure modes, stale draft archival. Current locked prefix is deliberately stricter than natural disclosure.
- M2a: all eight call providers remain planned; no live native connector, transcript ingestion, production anonymization, or semantic/source-integrity evaluation was implemented. Do not use the sample redactor for confidential real calls.
- M3/F8 gaps: public browser conversion API, value/currency/custom-type expansion, full period analytics/post-level reporting, performance benchmarks at PRD scale, key-by-key revocation, complete source-health reporting.
- M4 gaps: cash/noncash rewards, department eligibility, disqualification/reversal workflows, automatic 60-second leaderboard refresh, AI/company idea management, weekly reports and notifications. Current challenge time entry requires an explicit timezone offset.
- M5 gaps: provider-approved personal analytics, real-account end-to-end tests, production key rotation, robust provider error categorization and manual resolution UI for uncertain delivery. Uncertain requests stay locked to prevent duplicates.
- M6: HubSpot and Salesforce OAuth/sync/mappings/reversals not built.
- M7: Stripe billing/seat enforcement, Sentry, complete retention/deletion, complete security audit and external review not built. Do not onboard a paying production customer on this build.
- M8/M9: payout tables, two-person approvals, immutable money workflows, payroll exports, Gusto demo/production integration not built. External security review and Gusto partner approval cannot be completed in code.
- `publish_jobs` and `rate_buckets` are internal system tables. Rate buckets intentionally have no organization ID because they cover global hashed request identities; they have RLS and no member access.
- A dedicated new Supabase project is required for these initial migrations. The grants-hardening migration operates on the application’s public schema; do not apply it indiscriminately to a shared existing database.
- A filesystem process repeatedly created duplicate generated `.next/types/* 2.ts` files. TypeScript excludes only these duplicate generated files; real application sources and canonical Next types remain checked.
- No service secrets exist in the repository. `.env.example` describes setup; `.env.local` is ignored.


## GitHub repository upload — September 17, 2026

- User explicitly requested publishing the built app to their `machine` repository through the established GitHub connector.
- Confirmed destination `campbellcm/machine` was empty and public; uploaded all 118 tracked project files to `main` through the connector. No credentials, dependencies, or build outputs were included.
- Application import commit: `83de06a119a8caa094c33bb3fdd856e71d4aab73`. Its Git tree `0f18f7c5bd7c86b90323051d5fb9515711cdcb67` exactly matches local application commit `2ebff2b`.
- GitHub Actions run: https://github.com/campbellcm/machine/actions/runs/35172396749 (running when this note was written; no success claimed).
- Local `origin` now points to https://github.com/campbellcm/machine.git. Connector-created commits use a separate history from the local build commits; fetch and reconcile intentionally before a future command-line push. Do not force-push over GitHub history.
- This publishes source code, not a hosted website. Supabase, LinkedIn, AI, email, and hosting credentials remain unconfigured. Earlier notes about the absence of a remote describe the earlier build session.
