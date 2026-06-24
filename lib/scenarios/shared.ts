import type { InterviewLevel, Problem } from "../types";
import type { InterviewSignals } from "../interview-signals";
import type { Scenario, EvaluatorContext } from "./types";

// ---------------------------------------------------------------------------
// Cross-cutting blocks reused by EVERY scenario. These are scenario-agnostic on
// purpose — the level bar, the anti-fishing rule, and the behavioral-signal framing
// apply to any rubric-driven evaluation, so they live here and are written once.
// ---------------------------------------------------------------------------

// The bar a candidate is held to. The same answer can be a pass at Mid and a flag at Staff.
const LEVEL_LABEL: Record<InterviewLevel, string> = {
  mid: "Mid-level (L4)",
  senior: "Senior (L5)",
  staff: "Staff (L6)",
};

// A function that returns the L4/L5/L6 expectation text for a level. Scenarios may
// supply their own; otherwise this design-oriented default applies.
export type LevelExpectations = (level: InterviewLevel) => string;

export const defaultLevelExpectations: LevelExpectations = (level) => {
  switch (level) {
    case "mid":
      return `Bar for Mid-level (L4): a correct, working design with the right core components and a sensible data flow. They should handle the happy path well and go one level deep on at least one component. Deep operational concerns (multi-region, graceful degradation, cost) are a bonus, not required.`;
    case "senior":
      return `Bar for Senior (L5): drives the design independently, goes genuinely deep on 2-3 components, and proactively reasons about trade-offs, failure modes, and scaling — without being prompted for each. A working-but-shallow design is only Borderline at this level.`;
    case "staff":
      return `Bar for Staff (L6): everything expected of Senior, PLUS operational maturity — graceful degradation, multi-region/consistency trade-offs, failure isolation, cost, and org/cross-team concerns. A solid Senior-level answer (clean design, good deep-dives) only MEETS the bar here; Strong Hire requires breadth of judgment and operational depth.`;
  }
};

// Level block injected into the live interviewer prompt.
export function interviewerLevelContext(
  level: InterviewLevel,
  expectations: LevelExpectations = defaultLevelExpectations
): string {
  return `
TARGET LEVEL — you are interviewing this candidate for a ${LEVEL_LABEL[level]} role. ${expectations(level)}
Calibrate your probing to this bar: at higher levels push for depth, trade-offs, and failure modes; at Mid, a clean working answer is acceptable.`;
}

// Level block injected into the evaluation prompt.
function evalLevelContext(
  level: InterviewLevel,
  expectations: LevelExpectations = defaultLevelExpectations
): string {
  return `LEVEL CALIBRATION — score against the ${LEVEL_LABEL[level]} bar, not an absolute one. ${expectations(
    level
  )}
The verdict must reflect this bar (the SAME transcript can be Strong Hire at a lower level and Borderline at a higher one). In "feedback", explicitly state how the candidate measured against the ${LEVEL_LABEL[level]} bar and what they'd need for the next level up.`;
}

// The "you are an evaluator, never solve it for them" rule. Shared verbatim across scenarios.
export const antiSolveRule = `
CRITICAL — YOU ARE AN EVALUATOR, NOT AN ANSWERER:
Your only job is to ask questions and evaluate answers. You must NEVER answer questions that the candidate should be answering themselves.

THE CORE RULE: If the candidate asks you something about the design, the requirements, the trade-offs, or the approach — TURN IT BACK ON THEM. Always. No exceptions.

BANNED RESPONSES (never do these):
- Listing requirements when asked "what should the requirements be?"
- Explaining pros/cons when asked "what are the trade-offs of X vs Y?"
- Suggesting an approach when asked "how should I approach this?"
- Confirming a choice when asked "would X work here?" or "is X a good idea?"
- Explaining a concept when asked "what is X?" or "how does X work?"
- Answering "what should I consider?" or "what are the key aspects?"

HOW TO RESPOND INSTEAD — always flip the question back:
- "What should the requirements be?" → "What do YOU think the requirements are? Start with what the system needs to do."
- "What are the pros/cons of X vs Y?" → "You tell me — what trade-offs do you see between them?"
- "How should I approach this?" → "What's your instinct? Where would you start?"
- "Would strong consistency work here?" → "What do you think? Walk me through your reasoning."
- "What are the implications of X?" → "Good question — what implications do you see?"
- "What should I consider?" → "What have you considered so far?"

DETECTING ANSWER-FISHING:
Candidates will rephrase "solve this for me" as innocent-sounding questions. Recognize these patterns:
- Any "what should..." question about the design
- Any "what are the pros/cons/trade-offs..." question
- Any "how should I..." question about approach
- Any "would X work / is X good / should I use X" confirmation-seeking question
- Asking you to compare two options instead of proposing one themselves

When you catch this: call it out warmly but firmly. "That's the kind of question I should be asking you. What's your take?"

CLARIFICATION EXCEPTION (important — answer these briefly):
There is a difference between fishing for the SOLUTION and clarifying the PROBLEM. A real interviewer answers reasonable scoping questions.
- If the candidate asks a factual question about the PROBLEM's scope — expected scale, traffic volume, latency target, which features are in scope, what to optimize for — give a brief, concrete answer with a reasonable assumption. e.g. "Assume ~1M users and 100 requests/user/minute." / "Optimize for low-latency decisions, sub-10ms." This is GOOD candidate behavior — reward it by answering in one line.
- Only flip back questions where the candidate wants YOU to make a DESIGN decision (what database, which algorithm, what architecture, which trade-off is better). Those are theirs to answer.

HINTS: Only when the candidate explicitly asks for a hint. A hint = ONE Socratic question that points their thinking in a direction. Never a list, never a recommendation, never an explanation.`;

// Renders the ordered phase list block shared by every interviewer persona.
export function renderPhases(phases: string[]): string {
  return `Interview phases (in order):
${phases.map((p, i) => `${i + 1}. ${p}`).join("\n")}`;
}

// Behavioral context block injected into the evaluation prompt.
function buildSignalContext(signals: InterviewSignals): string {
  const pct = Math.round(signals.contributionRatio * 100);
  const qpct = Math.round(signals.questionRatio * 100);
  return `BEHAVIORAL SIGNALS (computed from the session — weigh these heavily):
- Hints requested: ${signals.hintsTaken}
- Times the candidate tried to get YOU (the interviewer) to answer for them: ${signals.fishingCount}
- Candidate's share of the conversation: ${pct}% (lower means the interviewer carried them)
- Of the candidate's messages, ${qpct}% were only questions rather than substantive design statements
- Deepest phase reached (based on candidate's own statements only): "${signals.maxPhaseLabel}"${signals.leakCount > 0 ? `\n- ⚠ Interviewer answer leaks detected: ${signals.leakCount} (times the interviewer may have given away part of the answer — discount any candidate knowledge that appeared only AFTER a leak)` : ""}

Interpretation guidance:
- High hint/fishing counts and low contribution = reliance, not independent problem-solving. Score lower.
- A candidate who debated trade-offs and navigated uncertainty well should score HIGHER than one who stayed silent but technically correct. Reward judgment and process over a polished final artifact.
- If the interviewer leaked answers, any topics the candidate covered AFTER the leak should be scored at most 1, not 2.`;
}

// Assembles the full evaluation prompt from a scenario's rubric + verdict bands + framing.
// The scores JSON skeleton and verdict guide are generated from the scenario's data, so a new
// scenario only supplies its dimensions and thresholds — no hand-written JSON per type.
export function assembleEvalPrompt(
  scenario: Scenario,
  problem: Problem,
  transcript: string,
  ctx: EvaluatorContext,
  signals: InterviewSignals,
  level: InterviewLevel
): string {
  const { rubric, verdict } = scenario;
  const scoresJson = rubric
    .map(
      (d) =>
        `    { "letter": "${d.letter}", "label": "${d.label}", "score": <0-3>, "evidence": "<one sentence from transcript>", "gap": "<what was missing or weak, or \\"\\" if nothing material was missing>" }`
    )
    .join(",\n");
  const verdictGuide = `Verdict guide: 0-${verdict.notReadyMax} = Not Ready, ${
    verdict.notReadyMax + 1
  }-${verdict.borderlineMax} = Borderline, ${verdict.borderlineMax + 1}-${
    verdict.maxTotal
  } = Strong Hire.`;

  return `${scenario.buildEvaluatorIntro(problem, ctx)}
${evalLevelContext(level, scenario.levelExpectations)}

${buildSignalContext(signals)}

Full interview transcript:
${transcript}

Respond with a JSON object only — no markdown, no explanation outside the JSON:
{
  "scores": [
${scoresJson}
  ],
  "total": <sum of scores, max ${verdict.maxTotal}>,
  "verdict": "<Not Ready|Borderline|Strong Hire>",
  "covered": ["<specific thing candidate did well>", ...],
  "missed": ["<specific gap with direct reference to what was missing>", ...],
  "stalled": ["<a specific moment where the candidate got stuck, hesitated, or needed a hint — empty array if none>", ...],
  "study_next": ["<topic to study>", ...],
  "feedback": "<2-3 sentence honest overall summary that explicitly reflects the behavioral signals above>"
}

${scenario.scoringGuide}

GAP–SCORE CONSISTENCY (applies to EVERY dimension — enforce strictly):
The "gap" you write and the "score" must agree. The top score (3) means "exceptional, with nothing material missing at the target level". Therefore:
- If you identify a real, substantive gap for a dimension, that dimension CANNOT score 3 — cap it at 2 ("solid, but with a gap"). A "no evidence of X" / "only verbal, not implemented" / "didn't cover X" note is a substantive gap.
- Only award 3 when the dimension is genuinely gap-free at the target level; set "gap": "" in that case.
- Do not give every dimension the same score. Differentiate based on what the candidate actually demonstrated versus what they merely mentioned.

${verdictGuide}`;
}
