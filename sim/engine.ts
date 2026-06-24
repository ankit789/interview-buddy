import type { Problem, Verdict, InterviewLevel } from "@/lib/types";
import { buildInterviewerSystemPrompt, buildEvaluationPrompt } from "@/lib/prompts";
import { getScenario } from "@/lib/scenarios";
import {
  computeSignals,
  applyVerdictGuardrails,
  isAskingForAnswer,
  type SignalMessage,
  type InterviewSignals,
} from "@/lib/interview-signals";
import { complete, type ProviderKeys } from "@/lib/llm";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { Persona } from "./personas";

export interface SimMessage {
  role: "user" | "assistant";
  content: string;
  message_type: "chat" | "hint";
}

export type SimStatus = "running" | "evaluating" | "completed" | "failed";

export interface SimEvaluation {
  scores: { letter: string; label: string; score: number; max: number; gap?: string }[];
  total: number;
  verdict: Verdict;
  rawVerdict: Verdict;
  capReason: string | null;
  covered: string[];
  missed: string[];
  stalled: string[];
  feedback: string;
}

export interface SimResult {
  problemId: string;
  problemTitle: string;
  persona: string;
  /** Lifecycle status — lets the UI show in-progress runs and survive a mid-run failure. */
  status: SimStatus;
  /** Total turns the run was configured for (so live view can show "turn 7 / 20"). */
  totalTurns: number;
  transcript: SimMessage[];
  signals: InterviewSignals;
  /** Null until evaluation completes. */
  evaluation: SimEvaluation | null;
  /** Heuristic flags about interviewer behavior (e.g. did it leak answers). */
  interviewerFlags: string[];
  /** Set when status is "failed". */
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Dynamic "thinking" pause before the next speaker responds — scales with how much / how
// complex the thing they're reacting to is, plus jitter for a natural, non-robotic rhythm.
// Also keeps us comfortably under burst limits.
function thinkDelayMs(reactingTo: string): number {
  const words = reactingTo.trim().split(/\s+/).length;
  const isComplex =
    /(consistency|race|concurren|failure|fault|trade.?off|shard|partition|replica|bottleneck|scal|estimat|latency|throughput|deep dive|edge case|cap theorem|quorum)/i.test(
      reactingTo
    );
  let ms = 1800 + words * 55 + (isComplex ? 1800 : 0);
  ms = Math.max(1800, Math.min(7000, ms)); // clamp 1.8s–7s
  return Math.round(ms * (0.8 + Math.random() * 0.4)); // ±20% jitter
}

// Animated "thinking" spinner — only in a TTY; in piped/background runs it's a no-op so the
// captured output stays clean (the transcript lines below still print).
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
function startSpinner(label: string): () => void {
  if (!process.stdout.isTTY) return () => {};
  let i = 0;
  process.stdout.write("\x1b[?25l"); // hide cursor
  const timer = setInterval(() => {
    process.stdout.write(`\r${SPINNER_FRAMES[i++ % SPINNER_FRAMES.length]} ${label}…  `);
  }, 80);
  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K\x1b[?25h"); // clear line + show cursor
  };
}

// Print a turn as it lands, mimicking a live transcript.
function printTurn(who: "interviewer" | "candidate", text: string): void {
  const label = who === "interviewer" ? "🎙️  interviewer" : "🧑  candidate ";
  process.stdout.write(`${label}  ${text}\n\n`);
}

async function chat(
  keys: ProviderKeys,
  messages: ChatCompletionMessageParam[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<string> {
  // Free-tier limits are RPM (requests/minute) with separate TPM/RPD headroom — a 429 just
  // means "this minute's request budget is spent". Wait out the full rolling window (~60s)
  // and retry; the sim self-paces instead of dying on the first burst.
  const MAX_ATTEMPTS = 8;
  const RPM_WINDOW_MS = 62000;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { text } = await complete(keys, messages, {
        json: opts.json,
        maxTokens: opts.maxTokens ?? 800,
        temperature: opts.temperature ?? 0.7,
        model: opts.model,
      });
      return text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rateLimited = /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(msg);
      if (rateLimited && attempt < MAX_ATTEMPTS - 1) {
        process.stderr.write(
          `    ⏳ RPM limit hit (${opts.model ?? "default"}), waiting 62s for window reset…\n`
        );
        await sleep(RPM_WINDOW_MS);
        continue;
      }
      throw e;
    }
  }
  throw new Error("chat() retries exhausted");
}

// Mirrors the candidate-side framing the real /api/interview/message route applies.
function withFishingNote(content: string): string {
  return isAskingForAnswer(content)
    ? `[SYSTEM NOTE: The candidate is asking you a question they should be answering themselves. Do NOT answer it. Flip it back to them with a Socratic question.] ${content}`
    : content;
}

// The interview is "complete" when the interviewer wraps up — not at an arbitrary turn count.
function isWrapUp(interviewerText: string): boolean {
  return /\b(wrap (it |things )?up|covered (a lot|enough|a good amount|good ground)|that'?s all|let'?s (stop|conclude|end|wrap)|give you (my|some) feedback|conclude (the|this|our) (interview|session)|in the interest of time|we'?re out of time|that concludes)\b/i.test(
    interviewerText
  );
}

// Detect obvious answer leaks in interviewer turns (the thing anti-solve hardening must prevent).
function detectLeak(interviewerText: string): boolean {
  const t = interviewerText.toLowerCase();
  // Explicit prescriptive phrasing — telling the candidate what to build
  if (
    /you should (use|add|implement|go with|choose|pick)\b/.test(t) ||
    /(here'?s|here is|let me give you) (the|a|how|my) (design|architecture|solution|approach|answer)/.test(t) ||
    /the (correct|right|best) (answer|design|approach) (is|would be)/.test(t)
  ) {
    return true;
  }
  // Numbered lists of 3+ design topics = roadmap leak (hands candidate a worksheet)
  const numberedPoints = (interviewerText.match(/\d+\.\s+\*\*/g) || []).length;
  if (numberedPoints >= 3) return true;
  // Directly answering requirement/constraint questions with specific numbers
  if (
    /the service must|we prefer|the system should aim|the decision must/.test(t) &&
    /\d+\s*(req|request|ms|millisecond|user|rps|%|percent)/i.test(t)
  ) {
    return true;
  }
  return false;
}

export async function runSimulation(
  problem: Problem,
  persona: Persona,
  turns: number,
  keys: ProviderKeys,
  onProgress?: (snapshot: SimResult) => void,
  level: InterviewLevel = "senior"
): Promise<SimResult> {
  const interviewerSystem = buildInterviewerSystemPrompt(problem, problem.type, level);
  const candidateSystem = persona.systemPrompt(problem, getScenario(problem.type));

  const transcript: SimMessage[] = [];
  const interviewerFlags: string[] = [];

  // Emit a live snapshot after each turn so the run is persisted incrementally:
  // the UI can show progress and the transcript survives a mid-run failure.
  function emit(status: SimStatus) {
    if (!onProgress) return;
    const sm: SignalMessage[] = transcript.map((m) => ({
      role: m.role,
      content: m.content,
      message_type: m.message_type,
    }));
    const sig = computeSignals(problem.type, sm);
    sig.leakCount = interviewerFlags.length;
    onProgress({
      problemId: problem.id,
      problemTitle: problem.title,
      persona: persona.id,
      status,
      totalTurns: turns,
      transcript: [...transcript],
      signals: sig,
      evaluation: null,
      interviewerFlags: [...interviewerFlags],
    });
  }

  // Interviewer turns are kept terse via the prompt's hard 2-sentence rule; budgets here are
  // safety ceilings with headroom for thinking-model overhead (Gemini/gpt-oss count thinking
  // tokens against the completion budget). Candidate gets room to do the heavy talking.
  const INTERVIEWER_TOKENS = 700;
  // Higher ceiling so the candidate can present a full end-to-end design in one turn.
  const CANDIDATE_TOKENS = 2400;

  // Interviewer + evaluator always run on the strong model (judgment matters). The candidate
  // runs on the persona's own model — weak personas get a weaker model so they can't fake depth.
  // Interviewer is the heavy consumer (one call per turn) and needs brevity + instruction-
  // following, not deep reasoning → run it on a fresh lite model. The evaluator (~1 call per
  // session) needs judgment → keep it on the stronger model. Candidate uses the persona's model.
  // Mistral free tier (~1 req/sec) handles the interviewer's per-turn volume without the
  // RPM stalls the Gemini free tier caused. Evaluator uses the same capable small model.
  const INTERVIEWER_MODEL = "mistral-small-latest";
  const EVALUATOR_MODEL = "mistral-small-latest";
  const candidateModel = persona.simModel;

  // A real interview is time-boxed. Once we hit this turn we have the interviewer deliver ONE
  // closing line and then go straight to evaluation — no trailing "thanks / looking forward to
  // your feedback" filler turns that go nowhere.
  const WRAP_UP_AFTER = Math.min(turns - 2, 18);

  // Candidate opens with a greeting; interviewer presents the problem (mirrors real UX).
  transcript.push({ role: "user", content: "hi", message_type: "chat" });
  let stop = startSpinner("interviewer is thinking");
  let interviewerReply = await chat(
    keys,
    [
      { role: "system", content: interviewerSystem },
      { role: "user", content: "hi" },
    ],
    { maxTokens: INTERVIEWER_TOKENS, model: INTERVIEWER_MODEL }
  );
  stop();
  printTurn("interviewer", interviewerReply);
  transcript.push({ role: "assistant", content: interviewerReply, message_type: "chat" });
  if (detectLeak(interviewerReply)) interviewerFlags.push("Leak on opening turn");
  // Candidate "reads" the opening before answering.
  await sleep(thinkDelayMs(interviewerReply));

  for (let i = 0; i < turns; i++) {
    // 1) Candidate (persona) responds to the latest interviewer message.
    stop = startSpinner(`${persona.id} candidate is thinking`);
    const candidateRaw = await chat(
      keys,
      [
        { role: "system", content: candidateSystem },
        // Replay transcript from the candidate's POV: interviewer = "user", candidate = "assistant"
        ...transcript.map((m) => ({
          role: m.role === "assistant" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        })),
        { role: "user", content: interviewerReply },
      ],
      { maxTokens: CANDIDATE_TOKENS, model: candidateModel }
    );
    stop();
    const candidate = candidateRaw.trim();
    const isHint = /\bhint\b/i.test(candidate);
    printTurn("candidate", candidate);
    transcript.push({ role: "user", content: candidate, message_type: isHint ? "hint" : "chat" });
    // Interviewer "reads" the candidate's answer before probing.
    await sleep(thinkDelayMs(candidate));

    // 2) Interviewer responds, with the same fishing-note framing the real route applies.
    const history: ChatCompletionMessageParam[] = transcript
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));
    // Once the interview has run long enough, nudge the interviewer to bring it to a close.
    let framed = withFishingNote(candidate);
    if (i >= WRAP_UP_AFTER) {
      framed = `[SYSTEM NOTE: This interview has run long enough. Wrap it up now — give a one-line acknowledgement and say you'll provide your feedback. Do NOT introduce a new topic or question.] ${framed}`;
    }
    stop = startSpinner("interviewer is thinking");
    interviewerReply = await chat(
      keys,
      [
        { role: "system", content: interviewerSystem },
        ...history,
        { role: "user", content: framed },
      ],
      { maxTokens: INTERVIEWER_TOKENS, model: INTERVIEWER_MODEL }
    );
    stop();
    printTurn("interviewer", interviewerReply);
    transcript.push({ role: "assistant", content: interviewerReply, message_type: "chat" });
    if (detectLeak(interviewerReply)) {
      interviewerFlags.push(`Possible answer leak at turn ${i + 1}`);
    }
    emit("running");

    // Stop as soon as the interview is done: either the interviewer wrapped up on its own, or
    // we've reached the wrap-up point (where its reply was the nudged closing line). Either way,
    // go straight to evaluation — never generate post-wrap-up filler turns.
    if (isWrapUp(interviewerReply) || i >= WRAP_UP_AFTER) break;

    // Candidate "thinks" before answering — longer for complex/probing questions.
    await sleep(thinkDelayMs(interviewerReply));
  }

  emit("evaluating");

  // ---- Evaluation (mirrors /api/interview/evaluate) ----
  const signalMsgs: SignalMessage[] = transcript.map((m) => ({
    role: m.role,
    content: m.content,
    message_type: m.message_type,
  }));
  const signals = computeSignals(problem.type, signalMsgs);

  // Feed leak count into signals so evaluation prompt and guardrails can use it
  signals.leakCount = interviewerFlags.length;

  const transcriptText = transcript
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");

  const evalPrompt = buildEvaluationPrompt(problem, problem.type, transcriptText, false, signals, level);

  // Self-consistency (mirrors the production evaluate route): sample the eval a few times and
  // take the median-total result, so single-sample noise can't flip a borderline verdict.
  // Each attempt also tolerates the occasional truncated/malformed JSON from reasoning models.
  const EVAL_SAMPLES = 3;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalCandidates: any[] = [];
  let lastRaw = "";
  for (let i = 0; i < EVAL_SAMPLES; i++) {
    const evalRaw = await chat(keys, [{ role: "user", content: evalPrompt }], {
      json: true,
      maxTokens: 4000,
      temperature: 0.3,
      model: EVALUATOR_MODEL,
    });
    lastRaw = evalRaw;
    const stripped = evalRaw.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "");
    const match = stripped.match(/\{[\s\S]*\}/);
    try {
      evalCandidates.push(JSON.parse(match ? match[0] : stripped));
    } catch {
      /* skip malformed sample */
    }
  }
  if (evalCandidates.length === 0) {
    throw new Error(`Evaluation JSON parse failed. Raw (last 300 chars): …${lastRaw.slice(-300)}`);
  }
  evalCandidates.sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
  const parsed = evalCandidates[Math.floor(evalCandidates.length / 2)];

  const rawVerdict = (parsed.verdict as Verdict) ?? "Not Ready";
  const { verdict, capReason } = applyVerdictGuardrails(rawVerdict, signals);

  return {
    problemId: problem.id,
    problemTitle: problem.title,
    persona: persona.id,
    status: "completed",
    totalTurns: turns,
    transcript,
    signals,
    evaluation: {
      // Stamp per-dimension max (the evaluator JSON omits it) exactly like the production
      // evaluate route, so totals render against the right denominator (e.g. 18/18, not 18/12).
      scores: ((parsed.scores ?? []) as Record<string, unknown>[]).map((s) => ({
        ...s,
        max: typeof s.max === "number" ? s.max : 3,
      })) as SimEvaluation["scores"],
      total: parsed.total ?? 0,
      verdict,
      rawVerdict,
      capReason,
      covered: parsed.covered ?? [],
      missed: parsed.missed ?? [],
      stalled: parsed.stalled ?? [],
      feedback: parsed.feedback ?? "",
    },
    interviewerFlags,
  };
}
