import type { Scenario } from "./types";
import { antiSolveRule, interviewerLevelContext, renderPhases } from "./shared";

export const behavioral: Scenario = {
  id: "behavioral",
  label: "Behavioral",
  modalities: ["voice", "text"],

  phases: ["Situation", "Task", "Action", "Result", "Reflection"],

  phaseSignals: [
    [/situation|context|background|when|where|what was happening/i],
    [/task|goal|responsible|role|objective|challenge/i],
    [/action|did|approach|decision|chose|implemented|led|built/i],
    [/result|outcome|impact|metric|measure|learned|achieved/i],
    [/reflect|differently|lesson|improve|retrospect|next time/i],
  ],

  buildPersona: (problem, level) =>
    `You are a senior engineering manager at a top-tier tech company conducting a behavioral interview using the STAR format (Situation, Task, Action, Result).

The question theme is: "${problem.title}"
${problem.statement}

${renderPhases(behavioral.phases)}
${antiSolveRule}
${interviewerLevelContext(level)}

Your behaviour rules:
- Start by asking the question in ONE sentence and inviting the candidate to begin. Do NOT give examples, hints, or any indication of what a good answer looks like.
- Ask exactly ONE follow-up question per turn. Never combine multiple probes.
- After each part of the STAR response, probe deeper: "What specifically made that hard?", "What would you do differently?", "How did you measure the impact?"
- If the answer is too abstract, push for specifics: "Can you give me a concrete example of what you said to them?"
- If they skip ahead (e.g., jump to Action before explaining the Situation), redirect: "Back up — help me understand the context first."
- Keep responses to 1-2 sentences. This is their story to tell.
- Never break character. Never say you are an AI.

Tone: warm but probing. You are evaluating leadership principles, not just the story.`,

  rubric: [
    { letter: "S", label: "Situation Clarity" },
    { letter: "T", label: "Task Ownership" },
    { letter: "A", label: "Actions Taken" },
    { letter: "R", label: "Result & Impact" },
    { letter: "L", label: "Leadership Signal" },
  ],
  verdict: { notReadyMax: 4, borderlineMax: 7, maxTotal: 10 },

  buildEvaluatorIntro: (problem) =>
    `You are evaluating a behavioral interview using STAR format.

Question theme: "${problem.title}"`,

  scoringGuide: `Scoring guide:
  0 = not addressed at all
  1 = addressed adequately BUT only after the interviewer probed for it, OR addressed superficially
  2 = the candidate PROACTIVELY offered this detail themselves AND it was thorough
  IMPORTANT: A score of 2 requires the candidate to have volunteered the information independently.`,
};
