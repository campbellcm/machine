import { z } from "zod";
import { sensitiveDetailSchema, redactKnownDetails } from "./privacy";

const callSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  duration: z.string(),
  category: z.string(),
  excerpts: z.array(
    z.object({
      id: z.string(),
      at: z.string(),
      speaker: z.enum(["You", "Customer", "Teammate"]),
      text: z.string(),
    }),
  ),
});
export type SampleCall = z.infer<typeof callSchema>;
export const sampleCalls = z.array(callSchema).parse([
  {
    id: "call-onboarding",
    title: "Customer onboarding check-in",
    date: "Sep 15",
    duration: "28 min",
    category: "Customer success",
    excerpts: [
      {
        id: "ownership-1",
        at: "04:12",
        speaker: "Customer",
        text: "At Northstar Labs, we finished the checklist, but nobody knew who owned the next step. Elena Ross had to chase three people.",
      },
      {
        id: "handoff-1",
        at: "08:40",
        speaker: "You",
        text: "A handoff needs a named owner and a next action. More documentation is not always the answer.",
      },
      {
        id: "sensitive-1",
        at: "17:05",
        speaker: "Customer",
        text: "Our renewal is worth $84,000. Please send the details to elena@northstar.example.",
      },
    ],
  },
  {
    id: "call-discovery",
    title: "Product discovery conversation",
    date: "Sep 14",
    duration: "34 min",
    category: "Product",
    excerpts: [
      {
        id: "ownership-2",
        at: "06:18",
        speaker: "Customer",
        text: "At Cedar Analytics, onboarding stalls when everyone assumes another team is responsible.",
      },
      {
        id: "discovery-1",
        at: "12:32",
        speaker: "You",
        text: "Before we discuss features, can we walk through where the work stops? Understanding the handoff helps us understand the problem.",
      },
      {
        id: "sensitive-2",
        at: "22:10",
        speaker: "Teammate",
        text: "Project Lantern launches on October 21. That roadmap is not public.",
      },
    ],
  },
  {
    id: "call-retro",
    title: "Team delivery retrospective",
    date: "Sep 12",
    duration: "22 min",
    category: "Internal work",
    excerpts: [
      {
        id: "handoff-2",
        at: "03:25",
        speaker: "You",
        text: "The decision behind a task matters just as much as the task. A good handoff explains why the next step matters.",
      },
      {
        id: "discovery-2",
        at: "09:10",
        speaker: "Teammate",
        text: "We asked for a walkthrough instead of another list of requirements. The team spotted a workflow problem before proposing a feature.",
      },
    ],
  },
]);
export const sampleSensitiveDetails = z.array(sensitiveDetailSchema).parse([
  {
    value: "Northstar Labs",
    kind: "company",
    replacement: "a customer company",
  },
  {
    value: "Cedar Analytics",
    kind: "company",
    replacement: "another customer company",
  },
  { value: "Elena Ross", kind: "person", replacement: "a customer contact" },
  {
    value: "elena@northstar.example",
    kind: "contact",
    replacement: "[contact details removed]",
  },
  {
    value: "$84,000",
    kind: "commercial",
    replacement: "[commercial amount removed]",
  },
  {
    value: "Project Lantern",
    kind: "roadmap",
    replacement: "[unreleased project removed]",
  },
  {
    value: "October 21",
    kind: "roadmap",
    replacement: "[launch date removed]",
  },
]);
export type SampleTheme = {
  id: string;
  title: string;
  description: string;
  reason: string;
  evidence: string[];
  draft: string;
};
export const sampleThemes: SampleTheme[] = [
  {
    id: "ownership",
    title: "A checklist is not an owner.",
    description:
      "Clear ownership matters more than another onboarding checklist.",
    reason:
      "The same friction appears in two customer conversations. It offers a practical lesson without needing customer-specific details.",
    evidence: ["ownership-1", "ownership-2"],
    draft:
      "I work at Acme. One question I keep coming back to in onboarding conversations: who owns the next step?\n\nA checklist can tell you what needs doing. It cannot take responsibility for moving the work forward.\n\nBefore adding another document, try making three things clear:\n\n• Who owns the handoff?\n• What happens next?\n• How will the next person know it is their turn?\n\nSometimes progress starts with clearer ownership, not more process.\n\nWhere does ownership become unclear in your workflow?",
  },
  {
    id: "handoffs",
    title: "Pass along the why, not just the what.",
    description: "Context helps the next person make a better decision.",
    reason:
      "Your own observations recur across customer work and an internal retrospective, making this a strong first-person angle.",
    evidence: ["handoff-1", "handoff-2"],
    draft:
      "I work at Acme. I have been thinking about what makes a useful handoff.\n\nPassing along a task is easy. Passing along the reasoning takes more care.\n\nWhat are we trying to achieve? Why did we choose this approach? What should the next person do?\n\nThose details give someone a starting point for making decisions, rather than another checklist to follow.\n\nThe next time you hand something over, try including the why.\n\nWhat context do you wish people shared more often?",
  },
  {
    id: "discovery",
    title: "Ask for a walkthrough before a feature list.",
    description: "The workflow can reveal the problem behind a request.",
    reason:
      "Two conversations point to the same discovery habit. The draft treats it as a lesson, without inventing a customer outcome.",
    evidence: ["discovery-1", "discovery-2"],
    draft:
      "I work at Acme. Before talking about a new feature, I like to ask: can you show me where the work stops?\n\nA feature request describes a possible solution. A walkthrough gives us a chance to understand the problem.\n\nWho has the work now? What are they waiting for? What information is missing?\n\nSometimes those questions lead back to the original request. Sometimes they reveal a handoff that needs attention first.\n\nEither way, the conversation becomes more useful.\n\nWhat do you ask before jumping to a solution?",
  },
];
export function evidenceForTheme(theme: SampleTheme, calls: SampleCall[]) {
  return calls.flatMap((call) =>
    call.excerpts
      .filter((e) => theme.evidence.includes(e.id))
      .map((e) => ({
        callId: call.id,
        callTitle: call.title,
        ...e,
        text: redactKnownDetails(e.text, sampleSensitiveDetails).text,
      })),
  );
}
