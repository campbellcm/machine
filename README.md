# Crewcast

The project now includes a Supabase-backed live-workspace implementation alongside the fictional demo. **The full PRD is not complete and this is not yet a production release.** See `PROGRESS.md` for the implemented flows, test evidence, and remaining engineering work.

- Open `http://127.0.0.1:3000/setup` for the in-app launch checklist.
- Open `/demo` for sample data. Never enter private data into the sample workflow.
- `/workspace` requires a configured Supabase project and authenticated membership.

## Configure a private pilot

Use a **new, dedicated Supabase project**, a Vercel project, and Node 24 LTS. No real accounts are configured in this checkout.

1. Copy `.env.example` to `.env.local`. Fill in your Supabase URL, publishable key and server-only service-role key. Set `NEXT_PUBLIC_APP_URL` to your exact app origin. Do not mix `localhost` and `127.0.0.1` in the same sign-in session.
2. Apply every SQL file in `supabase/migrations/` in filename order using Supabase migrations or its SQL editor. Do not rerun a migration after applying it. The database tests validate a clean install; do not apply the initial schema to a shared pre-existing database.
3. In Supabase Auth, set the site URL and allowed callback URL (`APP_ORIGIN/auth/callback`). Keep the default magic-link email template for the PKCE flow. Enable Google if wanted. Configure custom SMTP with a verified sending domain for production.
4. Restart the app, sign in, create a company, and complete the consent/profile screen. Test with a separate teammate account and a second company before sharing private data.
5. Add Anthropic credentials for generation and Resend credentials for invitations. `ANTHROPIC_MODEL=claude-sonnet-5` was verified against current official docs on September 17, 2026. Configure provider spending limits.
6. Create your LinkedIn developer app and enable OpenID Connect plus Share on LinkedIn. Register `HTTPS_APP_ORIGIN/api/social/linkedin/callback`. Add client credentials and a random 32-byte base64 token-encryption key. The app connects individual profiles, not company pages.
7. Set `VISITOR_HASH_SALT` to a separate random secret. Create a campaign and add its tracked link to a draft. Publish manually first, then test direct posting with your own approved text. Configure the conversion webhook on your server; never put its API key in browser JavaScript.
8. Set `CRON_SECRET` and deploy the supplied Vercel cron configuration on a plan supporting 15-minute jobs. Scheduled posting and challenge settlement do not run automatically on a plain local server. Verify one scheduled job before relying on it.

Generate independent secrets with `openssl rand -base64 32`. Keep them in `.env.local` or your hosting environment; never commit them or paste them into chat. Losing the encryption key makes existing social tokens unreadable and requires reconnecting profiles.

## Run and verify

```sh
npm ci
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs real PostgreSQL migrations and permission/state-machine tests in PGlite plus unit and mocked transport tests. It does not test Supabase Auth, PostgREST, Google, LinkedIn, Resend, or Anthropic against live services.

For the browser suite on a host that permits Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

The unconfigured setup tests assume empty Supabase variables. Real-account acceptance still requires signup, invite acceptance, cross-company isolation through Supabase’s API, draft approval, manual/direct publication, scheduled publication, tracked click, conversion deduplication, and disconnect/removal verification.

## Operational limits

- Confirm delivery on LinkedIn if a post says “publish uncertain.” Do not create a retry blindly: the provider may already have received it.
- Personal post analytics requires separate provider access and is not implemented here.
- All eight call-recording connectors, CRM sync, billing, weekly reports, and payroll still require engineering. Setup is not a substitute for those features.
- Cash reward and payroll workflows remain disabled. External security review and Gusto approval are prerequisites for live payroll work.
- No hosted deployment, real credentials, or remote CI run was created in this session.

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
