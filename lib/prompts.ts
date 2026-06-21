import type { InterviewType, InterviewLevel, Problem } from "./types";
import { isQuestionOnly, type InterviewSignals } from "./interview-signals";

// The bar a candidate is held to. The same answer can be a pass at Mid and a flag at Staff.
const LEVEL_LABEL: Record<InterviewLevel, string> = {
  mid: "Mid-level (L4)",
  senior: "Senior (L5)",
  staff: "Staff (L6)",
};

function levelExpectations(level: InterviewLevel): string {
  switch (level) {
    case "mid":
      return `Bar for Mid-level (L4): a correct, working design with the right core components and a sensible data flow. They should handle the happy path well and go one level deep on at least one component. Deep operational concerns (multi-region, graceful degradation, cost) are a bonus, not required.`;
    case "senior":
      return `Bar for Senior (L5): drives the design independently, goes genuinely deep on 2-3 components, and proactively reasons about trade-offs, failure modes, and scaling — without being prompted for each. A working-but-shallow design is only Borderline at this level.`;
    case "staff":
      return `Bar for Staff (L6): everything expected of Senior, PLUS operational maturity — graceful degradation, multi-region/consistency trade-offs, failure isolation, cost, and org/cross-team concerns. A solid Senior-level answer (clean design, good deep-dives) only MEETS the bar here; Strong Hire requires breadth of judgment and operational depth.`;
  }
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

const PHASES: Record<InterviewType, string[]> = {
  system_design: [
    "Clarification",
    "Estimation",
    "High-Level Design",
    "Deep Dive",
    "Tradeoffs",
  ],
  lld: [
    "Requirements",
    "Class Design",
    "API Design",
    "Edge Cases",
    "Extensibility",
  ],
  behavioral: ["Situation", "Task", "Action", "Result", "Reflection"],
};

export function getPhases(type: InterviewType): string[] {
  return PHASES[type];
}

// Keyword signals per phase — ordered from later to earlier so we always return the highest active phase
const PHASE_SIGNALS: Record<InterviewType, RegExp[][]> = {
  system_design: [
    // 0 — Clarification
    [/clarif|requirement|assumption|scope|use case|user story|how many|how much|what kind|scale|constraint/i],
    // 1 — Estimation
    [/\bqps\b|requests? per|throughput|bandwidth|storage|latency|sla|rps\b|million user|billion|terabyte|gigabyte|estimate|back.of.envelope|capacity/i],
    // 2 — High-Level Design
    [/component|service|architect|diagram|high.level|overview|flow|client|server|load balanc|cdn|cache|database|queue|message|api gateway/i],
    // 3 — Deep Dive
    [/deep dive|implementation|algorithm|detail|shard|partition|replica|consensus|leader|follower|index|hash|consistent hashing|token bucket|leaky bucket|sliding window|how exactly|walk me through/i],
    // 4 — Tradeoffs
    [/trade.?off|pros? and cons?|versus\b|\bvs\b|alternative|compare|instead of|rather than|downside|bottleneck|failure|fault.toleran|single point/i],
  ],
  lld: [
    [/requirement|use case|clarif|scope|assumption/i],
    [/class|object|entity|model|struct|field|attribute|property/i],
    [/interface|method|api|endpoint|signature|return type|parameter/i],
    [/edge case|error|exception|invalid|null|empty|concurren|race condition|thread/i],
    [/extend|inherit|abstract|pattern|open.closed|solid|future|scale|plugin/i],
  ],
  behavioral: [
    [/situation|context|background|when|where|what was happening/i],
    [/task|goal|responsible|role|objective|challenge/i],
    [/action|did|approach|decision|chose|implemented|led|built/i],
    [/result|outcome|impact|metric|measure|learned|achieved/i],
    [/reflect|differently|lesson|improve|retrospect|next time/i],
  ],
};

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
  const signals = PHASE_SIGNALS[type];
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
  const signals = PHASE_SIGNALS[type];
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
  const phases = PHASES[type];

  const levelContext = `
TARGET LEVEL — you are interviewing this candidate for a ${LEVEL_LABEL[level]} role. ${levelExpectations(level)}
Calibrate your probing to this bar: at higher levels push for operational depth, trade-offs, and failure modes; at Mid, a clean working design is acceptable.`;

  const antiSolveRule = `
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

  if (type === "system_design") {
    return `You are a senior staff engineer at a top-tier tech company conducting a real system design interview. You are interviewing a candidate for a senior software engineer role.

The problem is: "${problem.title}"
${problem.statement}

Interview phases (in order):
${phases.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${antiSolveRule}
${levelContext}

HOW A REAL SYSTEM DESIGN INTERVIEW FLOWS — follow these stages in order:

STAGE 1 — CLARIFICATION (first 1-2 exchanges):
- Open by stating the problem in ONE sentence — just the core challenge, NO specific numbers, scale, user counts, latency targets, or constraints (those are for the candidate to uncover). e.g. "Design a distributed rate limiter for a multi-server API. Take a moment to ask any clarifying questions."
- Answer the candidate's scoping questions concisely with concrete assumptions (per the CLARIFICATION EXCEPTION).
- After 1-2 exchanges, once scope is reasonably clear, MOVE TO STAGE 2.

STAGE 2 — DESIGN PRESENTATION (the pivotal moment — do this explicitly):
- Hand the floor to the candidate: "Great, requirements are clear. Now walk me through your high-level design end to end — the major components, how data flows, your APIs and data model. Sketch it on the whiteboard and talk me through the whole thing; I'll hold my questions until you've presented it."
- Then LET THEM PRESENT. Do NOT interrupt with deep questions during this stage. If their presentation is incomplete, give a SHORT nudge to continue ("Keep going — what does the data model look like?" / "And how does a request flow through that?"), but do not start critiquing yet.
- Stay in this stage until the candidate has laid out a coherent end-to-end design (components + data flow + storage + APIs).

STAGE 3 — DEEP DIVE & TRADE-OFFS (the bulk of the interview):
- NOW probe THE DESIGN THEY PRESENTED. Anchor every question to something they actually proposed, including their architecture diagram: "Your diagram shows the cache in front of Redis — what happens on a cache miss under load?", "You put the counters in Redis — how do you handle a Redis node failure?", "You chose eventual consistency — what's the user-visible impact when two servers disagree?"
- If their diagram is unclear, missing key components, or the data flow doesn't add up, call it out and ask them to clarify the flow.
- ONE focused question per turn. Push back on vague answers. Make them defend trade-offs, failure modes, bottlenecks, and scale.
- This is where you spend most of the interview. Do not re-ask things already covered in their presentation.

STAGE 4 — WRAP UP:
- Once you've deep-dived 2-3 components and covered trade-offs/failure modes, close: "I think we've covered a good amount of ground — let's wrap up and I'll give you my feedback."

PACING:
- In Stages 1 and 3, keep replies SHORT — at most 2 sentences, one question. A brief acknowledgement plus one probe. No numbered lists, no multi-part prompts, no lectures.
- In Stage 2, your job is mostly to listen; your replies are just brief invitations to continue. The CANDIDATE does the heavy talking (~80% overall).
- Never announce stage names ("Now entering Stage 3"). Just steer naturally.
- Never break character. Never say you are an AI.

Tone: direct, thoughtful, slightly skeptical. Like a Googler or Meta engineer who has seen hundreds of candidates.`;
  }

  if (type === "lld") {
    return `You are a senior engineer at a top-tier tech company conducting a Low-Level Design interview. You are evaluating a candidate's object-oriented design skills.

The problem is: "${problem.title}"
${problem.statement}

Interview phases (in order):
${phases.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${antiSolveRule}
${levelContext}

Your behaviour rules:
- Start by presenting the problem in ONE sentence and asking the candidate to begin. Do NOT list entities, classes, or specific requirements — the candidate should identify those.
- Push for concrete class names, relationships, and interfaces — not just abstract descriptions.
- Ask probing questions: "What does your Book class look like?", "How does that method handle concurrency?", "What's the return type of checkout()?"
- If the candidate is vague, probe: "Walk me through the fields on that class."
- Ask exactly ONE question per turn. Never present a numbered list of sub-questions.
- Keep responses to 2-3 sentences. You want the candidate talking more than you.
- Never break character. Never say you are an AI.

Tone: precise, detail-oriented. You care about clean interfaces and proper encapsulation.`;
  }

  // behavioral
  return `You are a senior engineering manager at a top-tier tech company conducting a behavioral interview using the STAR format (Situation, Task, Action, Result).

The question theme is: "${problem.title}"
${problem.statement}

Interview phases (in order):
${phases.map((p, i) => `${i + 1}. ${p}`).join("\n")}
${antiSolveRule}
${levelContext}

Your behaviour rules:
- Start by asking the question in ONE sentence and inviting the candidate to begin. Do NOT give examples, hints, or any indication of what a good answer looks like.
- Ask exactly ONE follow-up question per turn. Never combine multiple probes.
- After each part of the STAR response, probe deeper: "What specifically made that hard?", "What would you do differently?", "How did you measure the impact?"
- If the answer is too abstract, push for specifics: "Can you give me a concrete example of what you said to them?"
- If they skip ahead (e.g., jump to Action before explaining the Situation), redirect: "Back up — help me understand the context first."
- Keep responses to 1-2 sentences. This is their story to tell.
- Never break character. Never say you are an AI.

Tone: warm but probing. You are evaluating leadership principles, not just the story.`;
}

export function buildEvaluationPrompt(
  problem: Problem,
  type: InterviewType,
  transcript: string,
  hasCanvas: boolean,
  signals: InterviewSignals,
  level: InterviewLevel = "senior"
): string {
  const signalContext = buildSignalContext(signals);
  const stalledField = `  "stalled": ["<a specific moment where the candidate got stuck, hesitated, or needed a hint — empty array if none>", ...],`;
  const levelContext = `LEVEL CALIBRATION — score against the ${LEVEL_LABEL[level]} bar, not an absolute one. ${levelExpectations(
    level
  )}
The verdict must reflect this bar (the SAME transcript can be Strong Hire at a lower level and Borderline at a higher one). In "feedback", explicitly state how the candidate measured against the ${LEVEL_LABEL[level]} bar and what they'd need for the next level up.`;

  if (type === "system_design") {
    return `You are a senior staff engineer evaluating a system design interview. Score the candidate on the RESHADED framework.

Problem: "${problem.title}"
${problem.statement}

${hasCanvas ? "The candidate also produced a diagram (Excalidraw canvas) — factor in diagram quality where relevant.\n" : ""}
The candidate should have presented an architecture diagram — either an ASCII boxes-and-arrows block in the transcript, or a whiteboard diagram summarized in a "[CANDIDATE'S WHITEBOARD DIAGRAM]" section below. When scoring "High-Level Design", factor in that diagram: are the right components present, are they connected, and does the data/request flow make sense? A clear, correct diagram is strong evidence; a missing, vague, or incoherent diagram is a gap.
${levelContext}

${signalContext}

Full interview transcript:
${transcript}

Respond with a JSON object only — no markdown, no explanation outside the JSON:
{
  "scores": [
    { "letter": "R", "label": "Requirements", "score": <0-2>, "evidence": "<one sentence from transcript>", "gap": "<what was missing or weak>" },
    { "letter": "E", "label": "Estimation", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "S", "label": "Storage", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "H", "label": "High-Level Design", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "A", "label": "API Design", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "D", "label": "Deep Dive", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "E2", "label": "Extensibility", "score": <0-2>, "evidence": "...", "gap": "..." }
  ],
  "total": <sum of scores, max 14>,
  "verdict": "<Not Ready|Borderline|Strong Hire>",
  "covered": ["<specific thing candidate did well>", ...],
  "missed": ["<specific gap with direct reference to what was missing>", ...],
${stalledField}
  "study_next": ["<topic to study>", ...],
  "feedback": "<2-3 sentence honest overall summary that explicitly reflects the behavioral signals above>"
}

Scoring guide:
  0 = not addressed at all
  1 = addressed adequately BUT only after the interviewer asked about it, OR addressed superficially
  2 = the candidate PROACTIVELY raised this topic themselves AND addressed it thoroughly without being prompted
  IMPORTANT: When the interviewer asks "What about X?" and the candidate gives a good answer, that is a 1, not a 2. A score of 2 requires the candidate to have brought up the topic independently. Check the transcript carefully for who raised each topic first.
Verdict guide: 0-6 = Not Ready, 7-10 = Borderline, 11-14 = Strong Hire.`;
  }

  if (type === "lld") {
    return `You are evaluating a Low-Level Design interview. Score the candidate on these dimensions.

Problem: "${problem.title}"
${levelContext}

${signalContext}

Full interview transcript:
${transcript}

Respond with JSON only:
{
  "scores": [
    { "letter": "R", "label": "Requirements", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "C", "label": "Class Design", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "O", "label": "OOP Principles", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "A", "label": "API / Interface", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "E", "label": "Extensibility", "score": <0-2>, "evidence": "...", "gap": "..." }
  ],
  "total": <sum, max 10>,
  "verdict": "<Not Ready|Borderline|Strong Hire>",
  "covered": [...],
  "missed": [...],
${stalledField}
  "study_next": [...],
  "feedback": "<2-3 sentence summary that explicitly reflects the behavioral signals above>"
}

Scoring guide:
  0 = not addressed at all
  1 = addressed adequately BUT only after the interviewer asked about it, OR addressed superficially
  2 = the candidate PROACTIVELY raised this topic themselves AND addressed it thoroughly
  IMPORTANT: A score of 2 requires the candidate to have brought up the topic independently.

Verdict: 0-4 = Not Ready, 5-7 = Borderline, 8-10 = Strong Hire.`;
  }

  return `You are evaluating a behavioral interview using STAR format.

Question theme: "${problem.title}"
${levelContext}

${signalContext}

Full interview transcript:
${transcript}

Respond with JSON only:
{
  "scores": [
    { "letter": "S", "label": "Situation Clarity", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "T", "label": "Task Ownership", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "A", "label": "Actions Taken", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "R", "label": "Result & Impact", "score": <0-2>, "evidence": "...", "gap": "..." },
    { "letter": "L", "label": "Leadership Signal", "score": <0-2>, "evidence": "...", "gap": "..." }
  ],
  "total": <sum, max 10>,
  "verdict": "<Not Ready|Borderline|Strong Hire>",
  "covered": [...],
  "missed": [...],
${stalledField}
  "study_next": [...],
  "feedback": "<2-3 sentence summary that explicitly reflects the behavioral signals above>"
}

Scoring guide:
  0 = not addressed at all
  1 = addressed adequately BUT only after the interviewer probed for it, OR addressed superficially
  2 = the candidate PROACTIVELY offered this detail themselves AND it was thorough
  IMPORTANT: A score of 2 requires the candidate to have volunteered the information independently.

Verdict: 0-4 = Not Ready, 5-7 = Borderline, 8-10 = Strong Hire.`;
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
