export function interviewQuestion(index: number, role: string, focus: string) {
  const questions = [
    `What is one lesson from your work${role ? " as " + role : ""}${focus ? " about " + focus : ""} that others could use?`,
    "What happened that taught you that lesson? Leave out names and confidential details.",
    "What did you personally do, and what changed as a result? Use only facts you can share publicly.",
    "What would you tell someone facing the same problem?",
    "What did you initially get wrong or misunderstand?",
    "What is a concrete first step someone could try?",
    "What common advice would you challenge based on this experience?",
    "What should the reader remember?",
  ];
  return questions[Math.min(index, 7)];
}
