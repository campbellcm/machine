export const implementationStatus = [
  {
    area: "Accounts and organizations",
    status: "Implemented · live verification needed",
    detail:
      "Email and Google sign-in, company creation, roles, invitations, consent, and private storage. Requires Supabase and production email setup.",
  },
  {
    area: "Drafts and author approvals",
    status: "Implemented · AI account needed",
    detail:
      "Saved interviews, three generated drafts, editing, locked disclosure, blocked phrases, admin review, and final author approval. Streaming follow-ups and quick edits remain.",
  },
  {
    area: "LinkedIn publishing",
    status: "Implemented · developer app needed",
    detail:
      "Personal profile connection, encrypted tokens, manual and direct posting, and scheduling. Real profile testing and analytics approval remain.",
  },
  {
    area: "Attribution",
    status: "Implemented · pilot verification needed",
    detail:
      "Campaign links, privacy-preserving click counts, form attribution capture, idempotent conversion API, and live totals. Full CRM attribution remains.",
  },
  {
    area: "Ideas and challenges",
    status: "Partially implemented",
    detail:
      "40 role-based ideas and private no-reward challenges with settled results. AI ideas, weekly reports, and reward programs remain.",
  },
  {
    area: "Call recording integrations",
    status: "Not connected",
    detail:
      "All eight requested providers are cataloged. Native connections, permission checks, production anonymization, and source-grounded generation still need implementation and provider testing.",
  },
  {
    area: "HubSpot and Salesforce",
    status: "Not implemented",
    detail:
      "Needs provider apps, test accounts, OAuth, sync jobs, stage mappings, and attribution/reversal testing.",
  },
  {
    area: "Billing and production monitoring",
    status: "Not implemented",
    detail:
      "Stripe subscriptions, plan enforcement, Sentry, deletion workflows, and production security review remain.",
  },
  {
    area: "Cash rewards and payroll",
    status: "Not enabled",
    detail:
      "Two-person approvals, immutable payout records, CSV handoff, and Gusto draft sync remain. External security review and Gusto partner access are required before live payroll use.",
  },
];
