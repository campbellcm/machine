import type { ContentProfile, Strategy } from "./domain";
export type Source = {
  id: string;
  title: string;
  content: string;
  visibility: string;
  external_use: string;
  status: string;
  roles: string[];
  created_at: string;
  expires_at: string;
};
export type Idea = {
  id: string;
  atom_id: string;
  title: string;
  rationale: string;
  scores: { overall: number };
  status: string;
  expires_at: string;
};
export type EngineDraft = {
  is_owner: boolean;
  reviewer_approved?: boolean;
  id: string;
  body: string;
  channel: "linkedin" | "x";
  revision: number;
  state: string;
  invalidated: boolean;
  opportunity_id: string | null;
  source_ids: string[];
  atom_ids: string[];
  published_at: string | null;
  url: string | null;
  details: {
    topic?: string;
    audience?: string;
    objective?: string;
    rationale?: string;
    riskFlags?: string[];
    claimChecks?: { claim: string; evidence: string; supported: boolean }[];
  };
  versions: { revision: number; body: string }[];
};
export type EngineJob = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  error_code?: string;
  created_at: string;
  usage?: Record<string, unknown>;
};
export type AdminReport = {
  people: {
    id: string;
    name: string;
    role: string;
    enrolled: boolean;
    paused: boolean;
    cadence: string;
  }[];
  counts: {
    drafts: number;
    approved: number;
    published: number;
    rejected: number;
    review: number;
  };
  jobs: EngineJob[];
  feedback: { action: string; reason: string; total: number }[];
};
export type EngineData = {
  name: string;
  company: string;
  admin: boolean;
  ready: boolean;
  setupError: boolean;
  strategy: Strategy;
  profile: {
    config: ContentProfile;
    enrolled: boolean;
    paused: boolean;
    onboarding_step: number;
    preferences: Record<string, number>;
  } | null;
  sources: Source[];
  ideas: Idea[];
  drafts: EngineDraft[];
  jobs: EngineJob[];
  metrics: {
    draft_id: string;
    metrics: Record<string, number | null>;
    observed_at: string;
  }[];
  connections: { channel: "linkedin" | "x"; name: string; expired: boolean }[];
  adminReport: AdminReport | null;
};
