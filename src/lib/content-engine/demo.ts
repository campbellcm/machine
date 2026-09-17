import { defaultProfile, defaultStrategy, type ContentProfile } from "./domain";
import type { EngineData } from "./types";
export function contentDemo(
  role: "marketing" | "engineering" = "marketing",
): EngineData {
  const engineering = role === "engineering";
  const profile: ContentProfile = {
    ...defaultProfile,
    role: engineering ? "Engineering manager" : "Marketing manager",
    department: engineering ? "Engineering" : "Marketing",
    topics: engineering
      ? ["Engineering leadership", "Technical tradeoffs"]
      : ["Customer education", "Product positioning"],
    audience: engineering
      ? "Engineering leaders"
      : "Marketing and business leaders",
    voice: engineering
      ? ["Technical", "Thoughtful"]
      : ["Conversational", "Educational"],
  };
  const specific = engineering
    ? {
        id: "engineering-source",
        title: "Engineering project summary",
        content:
          "The team chose a modular monolith instead of adding new microservices. Shared deployment reduced operational complexity. The tradeoff was less independent scaling. This approved engineering note contains no customer details.",
      }
    : {
        id: "marketing-source",
        title: "Approved customer education note",
        content:
          "A recurring buyer concern is that a new project tool will add administrative work. The approved product walkthrough demonstrates a shared checklist that removes duplicate handoff questions. No quantitative benefit is claimed.",
      };
  const sources = [
    {
      id: "shared-launch",
      title: "Approved product update",
      content:
        "Acme is introducing a shared project checklist. Teams can make handoff responsibilities explicit. This is approved public launch context.",
    },
    specific,
  ].map((s) => ({
    ...s,
    visibility: "organization",
    external_use: "approved_fact",
    status: "ready",
    roles: s.id === "shared-launch" ? [] : [profile.role],
    created_at: "2026-09-17T12:00:00Z",
    expires_at: "2026-12-16T12:00:00Z",
  }));
  const body = engineering
    ? "I work at Acme. We chose a modular monolith over more microservices.\n\nIndependent scaling is useful. So is a deployment process the whole team can understand. For this project, reducing operational complexity mattered more.\n\nArchitecture decisions get clearer when we name the tradeoff, rather than argue for a pattern. What constraint is shaping your next technical decision?"
    : "I work at Acme. A useful product story starts with a buyer’s concern, not a feature list.\n\nOne recurring concern: will a new project tool create more admin work? Our shared checklist walkthrough focuses on making handoff responsibilities clear and avoiding duplicate questions.\n\nShow how the work changes. Let the feature support the story.";
  const idea = {
    id: "idea-" + role,
    atom_id: "atom-" + role,
    title: engineering
      ? "The tradeoff behind a simpler architecture"
      : "Answer the buyer concern behind the feature request",
    rationale: engineering
      ? "You lead engineering, and this approved project note offers a concrete technical lesson."
      : "You work in marketing, and this approved buyer concern is useful for customer education.",
    scores: { overall: 91 },
    status: "suggested",
    expires_at: "2026-12-16T12:00:00Z",
  };
  return {
    name: engineering ? "David" : "Sarah",
    company: "Acme",
    admin: true,
    ready: true,
    setupError: false,
    strategy: {
      ...defaultStrategy,
      enabled: true,
      description: "Acme helps teams clarify project handoffs.",
      products: "Shared project checklist",
      audiences: "Team leads",
      goals: "Educate buyers and share useful expertise",
      topics: "Better handoffs, clear ownership",
    },
    profile: {
      config: profile,
      enrolled: true,
      paused: false,
      onboarding_step: 6,
      preferences: {},
    },
    sources,
    ideas: [idea],
    drafts: [
      {
        is_owner: true,
        id: "draft-" + role,
        body,
        channel: "linkedin",
        revision: 1,
        state: "ready_for_employee",
        invalidated: false,
        opportunity_id: idea.id,
        source_ids: sources.map((s) => s.id),
        atom_ids: [idea.atom_id],
        published_at: null,
        url: null,
        details: {
          topic: idea.title,
          audience: profile.audience,
          objective: engineering ? "Technical credibility" : "Buyer education",
          rationale: idea.rationale,
          riskFlags: [],
          claimChecks: [],
        },
        versions: [{ revision: 1, body }],
      },
    ],
    jobs: [],
    metrics: [],
    connections: [],
    adminReport: {
      people: [
        {
          id: "marketing",
          name: "Sarah Chen",
          role: "Marketing manager",
          enrolled: true,
          paused: false,
          cadence: "weekdays",
        },
        {
          id: "engineering",
          name: "David Rivera",
          role: "Engineering manager",
          enrolled: true,
          paused: false,
          cadence: "three",
        },
      ],
      counts: { drafts: 2, approved: 0, published: 0, rejected: 0, review: 0 },
      jobs: [],
      feedback: [],
    },
  };
}
