import { z } from "zod";

// Provider capabilities researched 2026-09-17. These are planned connectors,
// not claims of authenticated integration or tested provider availability.
export const recorderProviderSchema = z.enum([
  "granola",
  "fathom",
  "fireflies",
  "circleback",
  "read-ai",
  "otter",
  "zoom",
  "avoma",
]);
export type RecorderProvider = z.infer<typeof recorderProviderSchema>;
export type Recorder = {
  id: RecorderProvider;
  name: string;
  mark: string;
  method: string;
  requirement: string;
  docs: string;
  status: "Planned";
};
export const recorders: Recorder[] = [
  {
    id: "granola",
    name: "Granola",
    mark: "G",
    method: "Transcript API + webhooks",
    requirement:
      "API access requires Business or Enterprise and appropriate note permissions.",
    docs: "https://docs.granola.ai/help-center/sharing/integrations/granola-api",
    status: "Planned",
  },
  {
    id: "fathom",
    name: "Fathom",
    mark: "F",
    method: "OAuth + transcript webhooks",
    requirement:
      "First connector to implement. Requires app registration and user authorization.",
    docs: "https://developers.fathom.ai/oauth",
    status: "Planned",
  },
  {
    id: "fireflies",
    name: "Fireflies",
    mark: "f",
    method: "GraphQL + transcript-ready events",
    requirement:
      "Use only eligible transcripts accessible to the authorized account.",
    docs: "https://docs.fireflies.ai/graphql-api/webhooks",
    status: "Planned",
  },
  {
    id: "circleback",
    name: "Circleback",
    mark: "C",
    method: "Meeting transcript API",
    requirement: "Requires an API key and authorized meeting access.",
    docs: "https://circleback.ai/docs/api",
    status: "Planned",
  },
  {
    id: "read-ai",
    name: "Read AI",
    mark: "R",
    method: "REST API with OAuth",
    requirement:
      "API is in beta. Workspace downloads must be enabled; refresh tokens rotate.",
    docs: "https://support.read.ai/hc/en-us/articles/49379985941523-Read-AI-API-and-MCP-Overview",
    status: "Planned",
  },
  {
    id: "otter",
    name: "Otter.ai",
    mark: "O",
    method: "Enterprise API + webhooks",
    requirement:
      "Native API requires Enterprise. Authorized TXT/SRT exports are a fallback.",
    docs: "https://help.otter.ai/hc/en-us/articles/36130822688279-Otter-ai-Public-API",
    status: "Planned",
  },
  {
    id: "zoom",
    name: "Zoom",
    mark: "Z",
    method: "Cloud recording transcripts",
    requirement:
      "Requires an available cloud transcript and recording access. Accept VTT exports.",
    docs: "https://developers.zoom.us/docs/api/meetings/",
    status: "Planned",
  },
  {
    id: "avoma",
    name: "Avoma",
    mark: "A",
    method: "Meeting transcript API",
    requirement:
      "API access is plan-dependent and credentials are managed by an admin.",
    docs: "https://help.avoma.com/api-documentation",
    status: "Planned",
  },
];
