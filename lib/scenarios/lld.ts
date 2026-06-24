import type { Scenario } from "./types";
import { antiSolveRule, interviewerLevelContext, renderPhases } from "./shared";

export const lld: Scenario = {
  id: "lld",
  label: "Low-Level Design",
  modalities: ["voice", "text", "code"],

  phases: ["Requirements", "Class Design", "API Design", "Edge Cases", "Extensibility"],

  phaseSignals: [
    [/requirement|use case|clarif|scope|assumption/i],
    [/class|object|entity|model|struct|field|attribute|property/i],
    [/interface|method|api|endpoint|signature|return type|parameter/i],
    [/edge case|error|exception|invalid|null|empty|concurren|race condition|thread/i],
    [/extend|inherit|abstract|pattern|open.closed|solid|future|scale|plugin/i],
  ],

  buildPersona: (problem, level) =>
    `You are a senior engineer at a top-tier tech company conducting a Low-Level Design interview. You are evaluating a candidate's object-oriented design skills.

The problem is: "${problem.title}"
${problem.statement}

${renderPhases(lld.phases)}
${antiSolveRule}
${interviewerLevelContext(level)}

Your behaviour rules:
- Start by presenting the problem in ONE sentence and asking the candidate to begin. Do NOT list entities, classes, or specific requirements — the candidate should identify those.
- Push for concrete class names, relationships, and interfaces — not just abstract descriptions.
- Ask probing questions: "What does your Book class look like?", "How does that method handle concurrency?", "What's the return type of checkout()?"
- If the candidate is vague, probe: "Walk me through the fields on that class."
- Ask exactly ONE question per turn. Never present a numbered list of sub-questions.
- Keep responses to 2-3 sentences. You want the candidate talking more than you.
- Never break character. Never say you are an AI.

Tone: precise, detail-oriented. You care about clean interfaces and proper encapsulation.`,

  rubric: [
    { letter: "R", label: "Requirements" },
    { letter: "C", label: "Class Design" },
    { letter: "O", label: "OOP Principles" },
    { letter: "A", label: "API / Interface" },
    { letter: "E", label: "Extensibility" },
  ],
  verdict: { notReadyMax: 6, borderlineMax: 11, maxTotal: 15 },

  buildEvaluatorIntro: (problem) =>
    `You are evaluating a Low-Level Design interview. Score the candidate on these dimensions.

Problem: "${problem.title}"

The candidate may have written actual code in an editor — if a "[CANDIDATE'S CODE]" section appears below, treat that code as the primary artifact for "Class Design", "OOP Principles", and "API / Interface": judge the real classes, fields, methods, relationships, and interfaces they declared, not just how they described them in chat. Concrete, well-structured code is strong evidence; no code or only a vague verbal description is a gap.`,

  scoringGuide: `Scoring guide (0-3 per dimension):
  0 = not addressed at all
  1 = addressed only after the interviewer asked about it, OR addressed superficially
  2 = SOLID (meets the bar): the candidate PROACTIVELY raised this AND addressed it with concrete, correct design
  3 = EXCEPTIONAL (exceeds the bar): proactive AND deep — clean abstractions, edge-case and concurrency rigor, or extensibility insight beyond a merely working design
  IMPORTANT: A score of 2 requires the candidate to have raised the topic independently. Reserve 3 for genuinely standout depth — do NOT give a 3 for a complete-but-ordinary answer.`,
};
