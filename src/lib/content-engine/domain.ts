import { z } from "zod";
export const platform = z.enum(["linkedin", "x"]);
const short = z.string().trim().max(2000);
export const profileSchema = z.object({
  role: z.string().trim().min(2).max(120),
  department: short.default(""),
  goals: z.array(z.string().max(200)).min(1).max(8),
  topics: z.array(z.string().max(120)).min(1).max(12),
  audience: short,
  voice: z.array(z.string().max(100)).max(8),
  examples: z.string().max(6000),
  avoid: short,
  cadence: z.enum(["weekdays", "three", "weekly", "manual"]),
  hour: z.number().int().min(0).max(23),
  timezone: z
    .string()
    .max(100)
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }),
  platform,
  delivery: z.literal("app"),
  mode: z.enum(["individual", "weekly"]),
});
export const strategySchema = z.object({
  description: short,
  products: short,
  audiences: short,
  goals: short,
  positioning: short,
  topics: short,
  campaigns: short,
  claims: short,
  avoid: short,
  disclaimer: z.string().max(250),
  roles: z.string().max(4000),
  review: z.boolean(),
  enabled: z.boolean(),
  employee_limit: z.number().int().min(1).max(10),
  daily_limit: z.number().int().min(1).max(200),
  monthly_limit: z.number().int().min(1).max(3000),
});
export type ContentProfile = z.infer<typeof profileSchema>;
export type Strategy = z.infer<typeof strategySchema>;
export const defaultProfile: ContentProfile = {
  role: "Marketing manager",
  department: "Marketing",
  goals: ["Educate potential customers"],
  topics: ["Customer education", "Product positioning"],
  audience: "Marketing and business leaders",
  voice: ["Conversational", "Educational"],
  examples: "",
  avoid: "Hype, invented anecdotes, engagement bait",
  cadence: "weekdays",
  hour: 9,
  timezone: "America/New_York",
  platform: "linkedin",
  delivery: "app",
  mode: "individual",
};
export const defaultStrategy: Strategy = {
  description: "",
  products: "",
  audiences: "",
  goals: "",
  positioning: "",
  topics: "",
  campaigns: "",
  claims: "",
  avoid: "Customer identities, private financial information, unreleased plans",
  disclaimer: "",
  roles:
    "Marketing: educate buyers with practical examples.\nEngineering: explain technical tradeoffs and lessons.",
  review: false,
  enabled: false,
  employee_limit: 3,
  daily_limit: 30,
  monthly_limit: 300,
};
export const reasons = [
  "Does not sound like me",
  "Too promotional",
  "Not insightful",
  "Factually incorrect",
  "Sensitive or confidential",
  "Repetitive",
  "Wrong audience",
  "Wrong timing",
  "Other",
];
export function redact(text: string) {
  return text
    .replace(
      /\b(?:sk-|ghp_|xox[baprs]-)[A-Za-z0-9_-]{8,}\b/g,
      "[secret removed]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email removed]")
    .replace(/\b(?:\d[ -]?){12,19}\b/g, "[identifier removed]")
    .replace(
      /(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g,
      "[phone removed]",
    );
}
export const sourceInput = z.object({
  title: z.string().trim().min(3).max(160),
  text: z.string().trim().min(30).max(16000),
  visibility: z.enum(["private", "organization"]),
  roles: z.array(z.string().max(120)).max(12),
  external_use: z.enum([
    "internal_only",
    "inspiration_only",
    "approved_fact",
    "approved_quote",
  ]),
  allowed_users: z.array(z.uuid()).max(100).default([]),
  consent: z.literal(true),
});
export const extractionSchema = z.object({
  atoms: z
    .array(
      z.object({
        type: z.enum([
          "customer_problem",
          "objection",
          "lesson",
          "product_update",
          "technical_tradeoff",
          "opinion",
          "process",
          "announcement",
        ]),
        summary: z.string().min(10).max(700),
        excerpt: z.string().min(5).max(1000),
        topics: z.array(z.string().max(80)).max(8),
        roles: z.array(z.string().max(120)).max(8),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(8),
});
export const draftOutput = z.object({
  platform,
  objective: z.string().max(300),
  audience: z.string().max(300),
  topic: z.string().max(200),
  brief: z.string().max(600),
  variants: z
    .array(
      z.object({
        body: z.string().min(1).max(3000),
        rationale: z.string().max(600),
        sourceIds: z.array(z.string()).min(1).max(8),
        atomIds: z.array(z.string()).min(1).max(8),
        claimChecks: z
          .array(
            z.object({
              claim: z.string().max(400),
              evidence: z.string().max(1000),
              supported: z.boolean(),
            }),
          )
          .max(12),
        riskFlags: z.array(z.string().max(300)).max(8),
        voiceScore: z.number().min(0).max(1),
      }),
    )
    .length(3),
});
export type Atom = {
  id: string;
  source_id: string;
  summary: string;
  excerpt: string;
  topics: string[];
  roles: string[];
  confidence: number;
  expires_at: string;
  created_at: string;
  external_use: string;
};
export function scoreOpportunity(
  atom: Atom,
  profile: ContentProfile,
  recent: string[],
  preference = 0,
  now = Date.now(),
) {
  const text = (atom.summary + " " + atom.topics.join(" ")).toLowerCase();
  const relevance =
    profile.topics.filter((t) => text.includes(t.toLowerCase())).length /
    Math.max(profile.topics.length, 1);
  const age = Math.max(0, (now - Date.parse(atom.created_at)) / 86400000);
  const freshness = Math.max(0, 1 - age / 90);
  const repeated = recent.some(
    (t) => t.toLowerCase() === atom.summary.toLowerCase(),
  );
  const evidence = atom.confidence;
  return {
    relevance,
    freshness,
    novelty: repeated ? 0 : 1,
    evidence,
    overall: Math.round(
      100 *
        (relevance * 0.3 +
          freshness * 0.2 +
          evidence * 0.3 +
          (repeated ? 0 : 0.2)) +
        Math.max(-10, Math.min(10, preference)),
    ),
  };
}
export function validateGeneration(
  raw: unknown,
  atoms: Atom[],
  company: string,
  target: "linkedin" | "x",
  avoid: string[],
) {
  const output = draftOutput.parse(raw);
  if (output.platform !== target) throw new Error("Platform mismatch");
  const valid = output.variants.map((v) => {
    if (
      v.atomIds.some((id) => !atoms.some((a) => a.id === id)) ||
      v.sourceIds.some((id) => !atoms.some((a) => a.source_id === id))
    )
      throw new Error("Invalid evidence");
    if (
      !v.body.startsWith(`I work at ${company}.`) ||
      [...v.body].length > (target === "x" ? 280 : 3000)
    )
      throw new Error("Disclosure or length");
    const flags = [...v.riskFlags];
    if (
      v.claimChecks.length &&
      atoms.some(
        (a) =>
          v.atomIds.includes(a.id) && a.external_use === "inspiration_only",
      )
    )
      flags.push(
        "Inspiration-only material cannot substantiate factual claims",
      );
    if (redact(v.body) !== v.body)
      flags.push("Possible personal or secret information");
    if (
      avoid.some(
        (term) =>
          term.trim() &&
          v.body.toLowerCase().includes(term.trim().toLowerCase()),
      )
    )
      flags.push("Restricted topic or phrase");
    for (const check of v.claimChecks)
      if (
        !check.supported ||
        !atoms.some(
          (a) =>
            a.excerpt.includes(check.evidence) && check.evidence.length > 4,
        )
      )
        flags.push("A factual claim needs confirmation");
    return { ...v, riskFlags: [...new Set(flags)] };
  });
  if (new Set(valid.map((v) => v.body.trim())).size !== 3)
    throw new Error("Duplicate variants");
  return {
    ...output,
    variants: valid.sort(
      (a, b) =>
        a.riskFlags.length - b.riskFlags.length || b.voiceScore - a.voiceScore,
    ),
  };
}
export function editDistance(a: string, b: string) {
  // Bounded normalized token edit distance; never logs text.
  const x = a.split(/\s+/).slice(0, 600),
    y = b.split(/\s+/).slice(0, 600);
  let row = Array.from({ length: y.length + 1 }, (_, i) => i);
  x.forEach((word, i) => {
    const next = [i + 1];
    y.forEach((w, j) =>
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (word === w ? 0 : 1)),
      ),
    );
    row = next;
  });
  return row[y.length] / Math.max(x.length, y.length, 1);
}
export function normalizeMetrics(input: Record<string, unknown>) {
  const keys = [
    "impressions",
    "reactions",
    "comments",
    "shares",
    "clicks",
    "profile_visits",
    "followers",
    "messages",
    "leads",
    "meetings",
    "opportunities",
    "revenue",
  ];
  return Object.fromEntries(
    keys.map((k) => [
      k,
      input[k] == null || input[k] === ""
        ? null
        : z.coerce.number().min(0).max(1e12).parse(input[k]),
    ]),
  );
}
