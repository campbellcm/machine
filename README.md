# Crewcast V1

Four tabs: **Home, Team, Rewards, AI**. LinkedIn and X are the two social channels. The fictional preview lives at `/demo`; private workspaces require Supabase sign-in. The current implementation is a pilot, not full PRD acceptance.

## Launch a private workspace on Netlify

1. Use Node 24 and a new dedicated Supabase project. Apply `supabase/migrations/*.sql` in filename order, including migrations 010–012 for V1. Never rerun applied migrations or put this initial schema in a shared existing database.
2. Set the Supabase URL, publishable key, and server-only service key from `.env.example` in Netlify. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS site URL. Configure Supabase Auth site/callback URLs, verified email delivery, and optional Google sign-in.
3. Sign in, create a company, opt in, complete your job title/topics, and add approved public business context under Team → Company settings.
4. Configure **OpenAI** (`OPENAI_API_KEY`, `OPENAI_MODEL`) and/or **Claude** (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`). Use API credentials, not consumer subscription cookies or tokens. Set provider spending limits. Members choose an available provider in AI.
5. Set a random `CRON_SECRET` in Netlify’s function environment. Two scheduled functions are deployed: daily drafting and maintenance, each every 15 minutes. They call protected same-site routes and only run on published deploys. No paid plan was selected. Verify a real scheduled invocation before enabling teammates.
6. In AI, select a channel, local delivery hour/timezone, and approved notes. Start daily drafts or generate today’s options immediately. Each day produces one batch of three private drafts; retries reuse the same run with at most three attempts. Pause/settings changes invalidate in-flight results. Review and approve each saved draft before publishing.
7. Configure LinkedIn OAuth with OpenID Connect and Share on LinkedIn, and callback `/api/social/linkedin/callback`. Set LinkedIn credentials and a random 32-byte base64 `TOKEN_ENCRYPTION_KEY`.
8. Configure X OAuth 2.0 as a Web App with callback `/api/social/x/callback`, `X_CLIENT_ID`, and `X_CLIENT_SECRET`. This pilot uses short-lived authorization; users reconnect after expiry. No refresh-token support or scheduled X posting yet. API access can have separate provider costs.
9. Configure `VISITOR_HASH_SALT`, create a tracked campaign, and configure the authenticated conversion webhook. No API keys in browser code. Resend is optional for invitations.

Keep secrets in hosting environment settings or ignored `.env.local`, never Git or chat. Generate secrets with `openssl rand -base64 32`.

## What works and what still needs accounts or engineering

- Home: date-filtered posts, unique clicks and leads, team rankings, and channel-filtered published content. Views and sales show unavailable until provider analytics/CRM ingestion exists.
- Team: safe connection metadata, personal LinkedIn/X connections, profile/consent, and admin invitations/settings.
- Rewards: admin-defined prize descriptions for clicks, leads or verified posts. All opted-in members participate; fixed rules lock on creation. Ties use earliest final scoring event then stable member ID. Finalize after 72 hours, then record company fulfillment. No payments or payroll. Impression/sales rewards and draft reward editing are not implemented.
- AI: OpenAI/Claude provider generation, private schedules, three options per day, bounded retries, author approval. Uses approved company/profile/notes context. Native Fathom, Slack and CRM ingestion remains planned. It does not import personal AI chat history.
- Daily queue processes two members per 15-minute slot (maximum 192 batches/day before retries). Busy periods delay delivery; expand worker capacity before a larger rollout. LinkedIn scheduled publishing processes one job per maintenance slot.
- X drafts use a conservative 280-code-point limit; the provider still validates its own weighted character rules. A rejected or ambiguous post remains locked for manual verification to prevent duplicate publication.
- Provider OAuth, generation, social publication, analytics and scheduled jobs still require real-account end-to-end verification. Supplying credentials does not complete the missing integrations.

## Run and test

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

On a sandbox that blocks Turbopack’s local port binding, `npx next build --webpack` is an alternative. Browser tests can target a running build with `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 npm run test:e2e`.

Tests cover real PostgreSQL migrations in PGlite, tenant and role isolation, private schedules, run leases/retries, approval and publishing protections, provider transport mocks, dates and rankings. Mock tests are not live provider verification. Chromium execution can be blocked by the host sandbox; CI runs the browser and accessibility suite.

---

## Historical demo notes

# Crewcast — M0 foundation

An explorable, local-first foundation for the product described in `PRD.md`. All people, posts, activity, and organization details are fictional. This is not yet a live SaaS product.

## Run locally

Use **Node.js 24 LTS** (or Node 22.12+ within the 22 release line). If you use nvm, run `nvm use` in this directory.

```sh
npm ci
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open **http://localhost:3000/demo**. No external accounts, paid subscriptions, or API keys are required. The environment file is optional unless you want to rename the product. `NEXT_PUBLIC_PRODUCT_NAME` controls the displayed name; restart after changing it.

If port 3000 is busy, stop the other development server or use `npm run dev -- --port 3001`. The dev launcher uses filesystem polling to accommodate hosts with low file-watcher limits. If a sandbox prevents hot reload, restart the development server after edits.

To run the optimized version:

```sh
npm run build
npm run start
```

## Explore the preview

- **Overview:** September and all-time metrics calculated from the fixtures; accessible click chart; recent post previews.
- **Call stories:** select fictional calls, inspect prepared themes and redacted evidence, edit a sample draft, review its facts/privacy, then copy the exact reviewed text. Editing or changing source selection clears review. The catalog covers Granola, Fathom, Fireflies, Circleback, Read AI, Otter.ai, Zoom, and Avoma with account-access notes. All live connections are planned; no real calls or credentials are accepted.
- **Content:** 38 sample posts, status filtering, search, and keyboard-accessible read-only previews.
- **Your team:** 12 fictional teammates, search and department filters, reconciled per-person counts.
- **Ideas:** six illustrative conversation starters with expandable prompts. These do not call AI or collect answers.
- **Settings:** sample organization details, product commitments, and integration availability.
- **Build roadmap:** M0–M9 and the path to the first useful interview-to-post workflow.
- **Appearance:** system light/dark default, with a header toggle that lasts for the current page session; mobile layout down to 375px.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run db:seed
npm run build
npx playwright install chromium
npm run test:e2e
```

The GitHub Actions workflow runs lint, strict type checking, unit tests, seed validation, production build, and browser tests. Browser tests include an axe accessibility audit. The browser suite requires a host that permits launching Chromium; the Codex host used for this build blocked that launch. See `PROGRESS.md` for actual verification results rather than treating the presence of a test as a passing result.

## Demo data and boundaries

`src/lib/demo/data.ts` creates and validates deterministic fixtures with Zod: one organization, 12 teammates, 38 posts, 964 click events, 43 conversions, and one no-reward challenge. `npm run db:seed` validates those fixtures; it intentionally does not connect to or modify a database. Re-running it is safe and produces the same data.

September reporting uses the sample organization's America/New_York month boundary. Bot and duplicate click events and reversed conversions are excluded. The demo reference period is September 2026, rather than the computer's current date.

There is **no authentication, database, RLS, AI, publishing, CRM, billing, payout, or payroll integration** yet. Do not replace these public fixtures with private company data. Real data requires Supabase Auth and RLS in M1. Nothing approves content, publishes to LinkedIn, submits payroll, or sends emails. Sample posts are read-only. The seeded challenge is not exposed as an operational reward program.

## Structure

- `src/app/`: Next.js App Router pages and responsive design tokens.
- `src/components/`: workspace UI and shadcn-style composable Button/Radix dialog primitives.
- `src/lib/demo/`: fixture validation and reporting selectors, with unit tests.
- `tests/`: desktop and mobile Playwright scenarios.
- `.github/workflows/ci.yml`: reproducible validation workflow.
- `design/crewcast-landing.html`: unchanged supplied visual reference; not a production marketing page.
- `PRD.md`, `HANDOFF.md`, `AGENTS.md`, `CLAUDE.md`: supplied project context.
- `PROGRESS.md`: shared build status, decisions, and known gaps.

The stack is Next.js App Router, strict TypeScript, React, Tailwind CSS, Lucide icons, Zod, Vitest, and Playwright. Installed dependency versions and the lockfile are checked in. Database migrations and production integration interfaces will be introduced when their milestones are implemented, without prematurely committing to an unreviewed schema.

## Preview deployment

A Vercel account and a GitHub repository are still needed for the PRD's hosted preview and remote CI requirements. Once the project is in your repository:

1. Import that repository in Vercel and choose the directory containing this `package.json` as the project root.
2. Select the Next.js preset and Node 24.
3. Set `NEXT_PUBLIC_PRODUCT_NAME` if desired. Do not add service keys to this demo.
4. Deploy a preview branch and verify it using the steps above.

M0 remains pending hosted verification and founder review. M1 is the next milestone; its schema and auth decisions should be reviewed before implementation.

Official setup references checked during the build: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs), and [shadcn/ui Button](https://ui.shadcn.com/docs/components/button).

## Call-to-content implementation boundary

`src/lib/calls/providers.ts` records all eight required providers and official access references. `intake.ts` validates the shared internal source contract and separates notes from complete transcripts; it is not a native API adapter or authorization layer. `fathom.ts` parses the documented Fathom transcript response shape only. `privacy.ts` demonstrates known-detail masking and exact-revision sample review. Live semantic anonymization, model calls, webhook transport, token handling, cross-provider meeting deduplication, and durable private drafts remain to be implemented after authentication and private storage. PRD F19 lists the full acceptance criteria.
