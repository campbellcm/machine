const prompts: Record<string, string[]> = {
  Sales: [
    "A question that revealed the real buying problem",
    "When walking away was the right sales decision",
    "How you make a discovery call useful to the buyer",
    "A handoff habit that builds trust after a sale",
    "A common misconception about your buyers",
  ],
  "Customer success": [
    "A small onboarding change that reduced confusion",
    "How you spot a customer who needs help",
    "A lesson from explaining the same feature differently",
    "What a healthy customer handoff looks like",
    "A question you ask before giving advice",
  ],
  Product: [
    "A customer request that changed your understanding",
    "How you decide what not to build",
    "What a prototype taught you that a meeting could not",
    "A tradeoff your team learned to discuss clearly",
    "How you define success before shipping",
  ],
  Engineering: [
    "A debugging habit that saves time",
    "How you explain a technical tradeoff to a teammate",
    "A lesson from simplifying an overcomplicated system",
    "What makes a useful code review",
    "How you make an incident review constructive",
  ],
  Marketing: [
    "A message you made clearer after listening to customers",
    "How you choose a useful story over a louder claim",
    "A lesson from testing an assumption",
    "What your team learned from a small experiment",
    "How you explain your audience’s problem in their words",
  ],
  Leadership: [
    "A decision you changed after hearing your team",
    "How you make priorities easier to understand",
    "A meeting habit you stopped using",
    "What you learned from delegating a meaningful decision",
    "How you make room for disagreement",
  ],
  Operations: [
    "A checklist that prevents a recurring mistake",
    "How you make ownership clear across teams",
    "A process you simplified instead of automating",
    "How you identify the real bottleneck",
    "A handoff you improved with one question",
  ],
  Design: [
    "A usability observation that changed your approach",
    "How you explain a design decision without jargon",
    "An assumption a prototype helped you question",
    "How you reduce friction in a familiar task",
    "What makes feedback useful during design review",
  ],
};
export const curatedIdeas = Object.entries(prompts).flatMap(([role, ideas]) =>
  ideas.map((prompt, index) => ({
    id: role.toLowerCase().replaceAll(" ", "-") + "-" + index,
    role,
    prompt,
  })),
);
