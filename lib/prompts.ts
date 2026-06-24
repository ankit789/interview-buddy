import type { InterviewType, InterviewLevel, Problem } from "./types";
import { isQuestionOnly, type InterviewSignals } from "./interview-signals";
import { getScenario } from "./scenarios";
import { assembleEvalPrompt } from "./scenarios/shared";

// prompts.ts is a thin facade over the scenario registry. Per-type knowledge (personas,
// phase models, rubrics, verdict bands) lives in lib/scenarios/*; this module keeps the
// stable function signatures the routes already call, so adding a scenario touches no
// call sites.

export function getPhases(type: InterviewType): string[] {
  return getScenario(type).phases;
}

export function detectPhaseFromMessages(
  type: InterviewType,
  messages: { role: string; content: string }[]
): number {
  // Only consider candidate messages, and only substantive ones (not pure questions)
  const recent = messages
    .slice(-6)
    .filter((m) => m.role === "user" && !isQuestionOnly(m.content))
    .map((m) => m.content)
    .join(" ");
  const signals = getScenario(type).phaseSignals;
  // Walk backwards — highest phase whose keywords appear wins
  for (let i = signals.length - 1; i >= 0; i--) {
    if (signals[i].some((re) => re.test(recent))) return i;
  }
  return 0;
}

// Highest phase reached across the entire conversation (candidate statements only)
export function detectMaxPhaseReached(
  type: InterviewType,
  messages: { role: string; content: string }[]
): number {
  // Only count candidate messages that contain substantive statements (not just questions)
  const candidateStatements = messages
    .filter((m) => m.role === "user" && !isQuestionOnly(m.content))
    .map((m) => m.content)
    .join(" ");
  const signals = getScenario(type).phaseSignals;
  for (let i = signals.length - 1; i >= 0; i--) {
    if (signals[i].some((re) => re.test(candidateStatements))) return i;
  }
  return 0;
}

export function buildInterviewerSystemPrompt(
  problem: Problem,
  type: InterviewType,
  level: InterviewLevel = "senior"
): string {
  return getScenario(type).buildPersona(problem, level);
}

export function buildEvaluationPrompt(
  problem: Problem,
  type: InterviewType,
  transcript: string,
  hasCanvas: boolean,
  signals: InterviewSignals,
  level: InterviewLevel = "senior"
): string {
  return assembleEvalPrompt(
    getScenario(type),
    problem,
    transcript,
    { hasCanvas },
    signals,
    level
  );
}

export function buildDiagramFeedbackPrompt(
  problem: Problem,
  elements: unknown[],
  transcript: string
): string {
  return `You are a senior engineer reviewing a system design diagram mid-interview.

Problem: "${problem.title}"

Current diagram elements (Excalidraw simplified):
${JSON.stringify(elements, null, 2)}

Recent conversation context:
${transcript.slice(-2000)}

Give focused, specific feedback on the diagram. Be direct — this is a coaching moment, not a lecture.

Respond with JSON only:
{
  "feedback": "<3-5 sentences: what's good, what's missing, what to add next>",
  "annotations": [
    { "note": "<short label to add to canvas>", "elementId": "<id of element to annotate, or null if general>" }
  ]
}

Max 3 annotations. Focus on the most impactful gaps.`;
}
