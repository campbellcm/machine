# AGENTS.md

Instructions for any AI coding agent working in this repository (Codex, Claude Code, or others). `CLAUDE.md` contains the same rules. Keep the two files identical when either changes.

You are building Crewcast, an employee content and advocacy SaaS. The full spec is in `PRD.md`. Background, decisions, and research notes are in `HANDOFF.md`. Read `PRD.md`, `PROGRESS.md`, and this file before any work.

## Source of truth

1. `PRD.md` wins over everything else.
2. This file wins over `HANDOFF.md`.
3. `design/crewcast-landing.html` is the visual reference only, not a product spec.
4. If sources conflict, follow the higher one and log the conflict in `PROGRESS.md`.

## How we work

- Build one milestone at a time from PRD Section 10. The current milestone is at the top of `PROGRESS.md`.
- Start each session by reading `PROGRESS.md`, then share a short plan for the next steps before writing large amounts of code.
- The founder is not a full-time engineer. Explain what you built and how to test it in plain language, with exact commands.
- When a milestone meets its acceptance criteria, stop. Update `PROGRESS.md` with what was built, test steps, decisions, and known issues. Wait for the founder to confirm before moving on.
- Ask before: adding a third-party service, making hard-to-undo data model changes, changing auth, or anything involving money, payroll, tokens, or personal data. Otherwise make a sensible choice and log it under "Decisions" in `PROGRESS.md`.
- Check current official documentation for LinkedIn, HubSpot, Salesforce, Gusto, Anthropic, Stripe, Supabase, and Resend before implementing integrations. Do not rely on memory for API details.
- Flag risks, assumptions, and anything that could hurt credibility with customers before building it, not after.

## Multiple agents on one repo

- Only one agent works on a branch at a time. Use one branch per milestone or feature, named `m{number}-{short-name}`.
- Merge through pull requests. Another agent or a human reviews each PR against the PRD acceptance criteria and the security checklist in PRD Section 11.
- Every agent reads and updates the same `PROGRESS.md`. Never keep progress notes anywhere else.
- Never rewrite migrations that have already been merged. Add new ones.

## Commands

Keep this section updated as scripts are added.

- `npm run dev` start the app
- `npm run lint` lint
- `npm run typecheck` type check
- `npm test` unit tests
- `npm run test:e2e` end-to-end tests
- `npm run build` production build
- `npm run start` run the production build
- `npx supabase start` local database (M1 onward; not configured in M0)
- `npm run db:seed` validate deterministic M0 demo fixtures (no database writes)

## Code standards

- TypeScript strict. No `any` without a comment explaining why.
- Validate all external input, webhook bodies, and AI output with Zod.
- Server-only code (tokens, service role key, AI calls) never imported into client components.
- Every table has RLS. Every new table gets an RLS test.
- Database changes only through Supabase migrations in the repo.
- AI prompts live in `src/lib/ai/prompts/` as versioned files.
- Product name comes from `NEXT_PUBLIC_PRODUCT_NAME`, never hardcoded in UI copy.
- Small, focused components. Co-locate tests with the code they test.
- Write tests for scoring, attribution, bot detection, guardrails, approvals, and encryption as you build them.
- Commit in small, working steps with clear messages. Never commit `.env` files or secrets.

## Never

- Never store raw IP addresses, or log tokens, secrets, or post content.
- Never publish content a teammate has not approved.
- Never scrape or read other people's social media content.
- Never store CRM contact names, emails, or phone numbers, or any bank, tax, or government ID data.
- Never hold, move, or disburse money. Payouts are approved in Crewcast and handed to the company's payroll provider as an unsubmitted draft or an export. Never call any endpoint that submits or funds a payroll.
- Never let an admin approve or publish on a teammate's behalf.

## Reward programs are private

- Challenges, leaderboards, reward amounts, and payouts are visible only inside the organization.
- Never pass reward, challenge, payout, or CRM contact data to the AI features.
- Posts disclose the employment relationship, never the reward.

## Design

Match `design/crewcast-landing.html` and PRD Section 9. Clean, spacious, pill buttons, large radius cards, the landing page color tokens, light and dark mode, mobile friendly teammate flows, WCAG AA. Payout screens are calm and precise, with confirmation steps for anything involving money.
