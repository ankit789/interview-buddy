import type { InterviewType, Verdict } from "./types";
import { detectMaxPhaseReached, getPhases } from "./prompts";

export interface SignalMessage {
  role: "user" | "assistant";
  content: string;
  message_type?: "chat" | "hint" | "diagram_feedback";
}

export interface InterviewSignals {
  /** Number of times the candidate explicitly asked for a hint */
  hintsTaken: number;
  /** Number of candidate messages that tried to get the interviewer to answer for them */
  fishingCount: number;
  /** Candidate share of total conversation, 0..1 (how much they drove vs were carried) */
  contributionRatio: number;
  /** Share of candidate messages that were only questions, 0..1 (asking vs designing) */
  questionRatio: number;
  /** Total substantive candidate messages */
  candidateMessages: number;
  /** Highest phase reached, 0-indexed */
  maxPhaseReached: number;
  /** Human label for the highest phase reached */
  maxPhaseLabel: string;
  /** Number of times the interviewer may have leaked an answer (sim only) */
  leakCount: number;
}

// Detect when a candidate is asking the interviewer to answer interview questions for them.
// Shared by the live message route (to nudge the model) and the evaluator (to score reliance).
export function isAskingForAnswer(content: string): boolean {
  const lower = content.toLowerCase().trim();
  const patterns = [
    /^(so\s+)?what (should|would|are|is|could|can|do) (the|a|we|i|you)/,
    /^how should (i|we|the system)/,
    /^(can you |could you |please )?(explain|tell me|describe|list|give me|walk me through|outline)/,
    /what (are the |would be the )?(pros|cons|trade[ -]?offs|advantages|disadvantages|benefits|downsides)/,
    /what (approach|strategy|design|architecture|pattern|solution)/,
    /(should|would|could|can) (i |we )?(use|go with|pick|choose|implement|start with)/,
    /^(is|would|does|do|should|can|could) (that|this|it|x|[a-z]+ )/,
    /^what (components?|services?|parts?|pieces?|things?|aspects?|factors?|considerations?)/,
    /how (do|does|would|should|can|could) (it|this|that|the system|we|i)/,
    /^(any|what) (suggestions?|recommendations?|thoughts?|ideas?)/,
    // --- NEW patterns for cooperative-framing and conditional fishing ---
    /^(should|would|could|can) we (use|go with|design|assume|start|pick|build|implement)/,
    /^are there any (constraints?|requirements?|limitations?|expectations?|guarantees?)/,
    /^(do|does) (the|this) (system|service|design|problem) (need|require|have) to/,
    /would you (prefer|recommend|suggest|rather|say)/,
    /is (the|a|our) priority to/,
    /could you (tell|give|help|clarify|confirm)/,
    /^(just to |before I )?(make sure|confirm|clarify|check|verify)/,
  ];
  return patterns.some((p) => p.test(lower));
}

export function isQuestionOnly(content: string): boolean {
  const trimmed = content.trim();
  // Split into sentences — count question marks and declarative sentences separately
  const questionMarks = (trimmed.match(/\?/g) || []).length;
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const totalSegments = sentences.length + questionMarks;
  if (totalSegments === 0) return true;
  const questionRatio = questionMarks / totalSegments;
  // Check for substantive design keywords that indicate real contribution
  const hasDesignContent =
    /\b(use|implement|store|shard|cache|replicate|partition|queue|hash|bucket|counter|token|algorithm|database|redis|kafka|load balanc|service|component|server|client|api|endpoint|schema|table|index)/i.test(
      trimmed
    );
  // If mostly questions AND no substantive design statements, it's question-only
  return questionRatio > 0.6 && !hasDesignContent;
}

export function computeSignals(
  type: InterviewType,
  messages: SignalMessage[]
): InterviewSignals {
  const candidate = messages.filter((m) => m.role === "user");
  const interviewer = messages.filter((m) => m.role === "assistant");

  const hintsTaken = candidate.filter((m) => m.message_type === "hint").length;
  // Fishing = asking the interviewer for the answer INSTEAD of contributing. A substantive
  // design message ("we could use Redis…") is a contribution, not fishing, even if it contains
  // a matching phrase — so only count messages that are question-only AND match the pattern.
  const fishingCount = candidate.filter(
    (m) => isQuestionOnly(m.content) && isAskingForAnswer(m.content)
  ).length;

  const candidateChars = candidate.reduce((sum, m) => sum + m.content.length, 0);
  const interviewerChars = interviewer.reduce((sum, m) => sum + m.content.length, 0);
  const totalChars = candidateChars + interviewerChars;
  const contributionRatio = totalChars === 0 ? 0 : candidateChars / totalChars;

  const questionMessages = candidate.filter((m) => isQuestionOnly(m.content)).length;
  const questionRatio = candidate.length === 0 ? 0 : questionMessages / candidate.length;

  const maxPhaseReached = detectMaxPhaseReached(type, messages);
  const phases = getPhases(type);

  return {
    hintsTaken,
    fishingCount,
    contributionRatio,
    questionRatio,
    candidateMessages: candidate.length,
    maxPhaseReached,
    maxPhaseLabel: phases[maxPhaseReached] ?? phases[0],
    leakCount: 0,
  };
}

const VERDICT_RANK: Record<Verdict, number> = {
  "Not Ready": 0,
  Borderline: 1,
  "Strong Hire": 2,
};

// Deterministic guardrails: a serious behavioral flag caps the verdict regardless of
// the LLM's content score — mirroring real interviews where one critical flag outweighs passes.
export function applyVerdictGuardrails(
  verdict: Verdict,
  signals: InterviewSignals
): { verdict: Verdict; capReason: string | null } {
  const flags: string[] = [];
  if (signals.fishingCount >= 3) {
    flags.push(`asked the interviewer to solve parts of the problem ${signals.fishingCount} times`);
  }
  if (signals.contributionRatio < 0.3 && signals.candidateMessages >= 3) {
    flags.push(
      `the interviewer drove most of the conversation (candidate contributed only ${Math.round(
        signals.contributionRatio * 100
      )}%)`
    );
  }
  if (signals.hintsTaken >= 4) {
    flags.push(`relied on ${signals.hintsTaken} hints`);
  }
  if (signals.questionRatio >= 0.7 && signals.candidateMessages >= 4) {
    flags.push(
      `${Math.round(signals.questionRatio * 100)}% of candidate messages were only questions, not design contributions`
    );
  }
  if (signals.leakCount >= 2) {
    flags.push(
      `interviewer leaked answers ${signals.leakCount} times, potentially inflating candidate performance`
    );
  }

  if (flags.length === 0) return { verdict, capReason: null };

  // Cap at Borderline — never allow "Strong Hire" when a serious flag is present.
  const cap: Verdict = "Borderline";
  if (VERDICT_RANK[verdict] > VERDICT_RANK[cap]) {
    return {
      verdict: cap,
      capReason: `Verdict capped at "${cap}" because ${flags.join("; ")}.`,
    };
  }
  return { verdict, capReason: null };
}
