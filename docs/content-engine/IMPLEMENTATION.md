# Employee content engine — first release

This implementation is the manual-source vertical slice requested in BUILD-SPEC.md. It changes only the AI main content in the existing workspace. Home, Team, Rewards, navigation, authentication and connection settings are unchanged. The original broader roadmap is not complete.

## What works

- Company opt-in controls and six-step employee content identity, pause/resume, preference reset and explicit deletion.
- Approved manual notes/transcripts, private or shared with explicitly selected users; optional roles guide relevance and do not grant access.
- Exact-excerpt extraction, deterministic opportunity ranking, three structured OpenAI draft variants per generation, provenance, risk flags, immutable version records, feedback and daily preparation.
- Employee editing, explicit revision-bound approval, optional company review followed by final employee approval, copy/text export, manually recorded publication and normalized manual performance observations.
- Admin strategy, participation, review queue and sanitized usage/activity reports. Fictional marketing and engineering personas demonstrate different drafts and approved context.

## Setup

1. Complete the existing `/setup` steps for Supabase. Apply all migrations in order, including `supabase/migrations/202609170014_content_engine.sql`, to a test database before production. The migration is additive; retain backups before applying it to a populated project.
2. In Netlify environment settings, configure existing Supabase public URL/key and server-only `SUPABASE_SERVICE_ROLE_KEY`. Set `NEXT_PUBLIC_APP_URL` to the production origin.
3. Set server-only `OPENAI_API_KEY` and `OPENAI_MODEL` to a model your account supports through the Responses API with structured outputs. Optional `OPENAI_CONTENT_MODEL` and `OPENAI_EXTRACTION_MODEL` override it. Never enter a personal ChatGPT password or expose API keys in public variables.
4. Set a high-entropy server-only `CRON_SECRET`, redeploy, and confirm the scheduled `content-engine` function is enabled. It calls the authenticated queue route at minutes 3, 18, 33 and 48 each hour. No new paid Netlify plan or service is provisioned by this release. Actual model requests consume the company’s provider quota.
5. Sign in as an owner/admin. In AI administration → Content Strategy, complete the company context and enable the engine. Each employee explicitly opts in. Add an approved source, wait for extraction, choose Find ideas, then Prepare a post. Three drafts appear under Drafts. Daily preparation uses the same pipeline after enrollment.
6. Validate with two real test members: private sources must remain private, reviewers see only submitted draft text, and one employee cannot approve or export another’s post. Inspect provider usage without logging prompts or content.

## Architecture

`ce_command` is the authenticated transactional mutation boundary. All ten `ce_*` tables use RLS and deny direct authenticated writes. Service-only `ce_tick`, `ce_claim` and `ce_finish` enforce tenant boundaries, enrollment, source expiry, leases, configuration revisions, idempotency and bounded retries. A job is rechecked before saving. The worker processes at most two jobs per invocation and one concurrent job per organization. Failed requests retry with backoff, at most three attempts. Defaults cap three generations per employee/day, 30 company jobs/day and 300/month; extraction and ranking count toward organization limits.

Versioned prompts are in `src/lib/ai/prompts/content-engine-v1.ts`. `src/lib/content-engine/service.ts` uses the official OpenAI SDK, `store:false`, bounded output and structured schemas. Only authorized evidence and explicitly selected company/profile fields reach the provider. There is no provider call in the browser, and no reward or CRM-contact query in this engine.

Source deletion/expiry invalidates dependent unpublished drafts and approvals. Published records remain historical but invalidated; deleting the employee content profile removes their engine records. Raw approved notes are stored in Supabase under RLS for at most 90 days; no new field-level source encryption was added. Do not upload confidential material. Automatic redaction is a limited aid and does not reliably remove company names or every identifier; employees must anonymize and approve notes before submission.

## Current limits

- No personal ChatGPT/Claude OAuth, Slack/CRM sync, call-recorder sync, file ingestion, semantic/vector retrieval, email/mobile delivery or weekly packs in this slice. Integration entries clearly show unavailable status. The connector interfaces are extension points, not live integrations.
- No automatic scheduling or social publishing for these drafts. Approved copy/export is the release path; old publishing RPCs cannot bypass content-engine approval. Existing social connections elsewhere in the app remain unchanged.
- No automatic metric sync or verified attribution. Publication URLs and results are explicitly self-reported. Admin analytics summarize workflow activity, not return on investment.
- Model validation flags likely unsupported claims and common identifiers; it does not prove every statement factual. Author review is mandatory.
- Cron stages may take multiple 15-minute runs. Job counts bound volume but are not a dollar-denominated budget; provider project limits should also be configured.
- Editing old drafts through a legacy interface is not the supported content-engine workflow; use AI → Drafts.
- Provider calls, hosted Supabase migrations, real-account authorization and production publishing cannot be verified until credentials/accounts are configured. Tests use real PostgreSQL semantics via PGlite and a mocked model provider; no paid model calls were made.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:seed`, `npm run build`, and `npm run test:e2e`. New tests cover all ten RLS tables, explicit source ACLs, consent, extraction, jobs, draft generation, optimistic revisions, review/export, immutable publication, source revocation, pause, output validation and provider-context minimization. Existing Home, Team, Rewards, setup and call tests remain in the suite.

Rollback application UI by reverting the feature commit; disable AI in company strategy to stop preparation. Do not drop data tables to roll back the UI.

## M7 daily setup update

Apply migration 015 after 014 for the simplified setup screen. Employees select 1–10 draft options per daily generation; legacy profiles default to three. The daily cadence includes weekends. Delivery preference (email, Slack, iMessage or WhatsApp) is saved separately from actual delivery, which remains inside the app; none of those transports is connected by this update. Provider output and database persistence enforce the selected count. Output token allowance scales with the count, bounded at 12,000; existing request timeouts and retries still apply, and high-volume generation needs live provider verification. No new environment variables or services are required.
