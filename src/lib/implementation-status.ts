export const implementationStatus = [
  {
    area: "Home & Team",
    status: "Implemented · database setup required",
    detail:
      "Date-filtered posts, unique clicks and leads, team ranking, published feed, and safe LinkedIn/X connection status. Views and sales remain unavailable until analytics and CRM integration are implemented.",
  },
  {
    area: "Daily AI drafts",
    status: "Implemented · API credentials required",
    detail:
      "OpenAI or Claude, role and approved context, three private options daily, timezone schedule, run now, pause, bounded retries and author approval. Native Fathom, Slack and CRM ingestion is not implemented.",
  },
  {
    area: "LinkedIn & X",
    status: "Implemented · real-account verification needed",
    detail:
      "OAuth, encrypted tokens, manual/API text posting and author approvals. LinkedIn scheduling supported. X currently requires reconnecting after its short-lived authorization expires; automatic refresh and scheduled X posts are not enabled.",
  },
  {
    area: "Rewards",
    status: "Implemented for posts, clicks and leads",
    detail:
      "Admins define any prize description and fixed rules; members see standings, final results and fulfillment status. All opted-in members participate. Impression/sales competitions and draft reward editing are not yet implemented. Company fulfills prizes outside the app.",
  },
];
