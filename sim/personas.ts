import type { Problem } from "@/lib/types";
import type { Scenario } from "@/lib/scenarios";

export type PersonaId = "junior" | "mid" | "senior" | "fisher";

// Per-persona candidate model (Mistral ladder). A weaker model can't fake competence, so the
// junior scores believably low; the larger model lets the senior actually demonstrate depth.
// This native size ladder (3b → 8b → small) is what produces realistic skill stratification.
const MODEL_3B = "ministral-3b-latest"; // weakest — junior / fisher
const MODEL_14B = "ministral-14b-latest"; // middling — mid
const MODEL_SMALL = "mistral-small-latest"; // strong — senior

export interface Persona {
  id: PersonaId;
  label: string;
  /** What we expect the engine to conclude — used in the report, not enforced. */
  expectedVerdicts: string[];
  /** Model used to play this candidate — weak personas get a weaker model for realism. */
  simModel: string;
  /** Builds the system prompt that drives the candidate simulator. */
  systemPrompt: (problem: Problem, scenario: Scenario) => string;
}

// What "presenting your work" means depends on the scenario's modality: a diagram for
// whiteboard rounds, code for code rounds, neither for a conversation-only round.
function presentHint(scenario: Scenario): string {
  if (scenario.modalities.includes("whiteboard")) {
    return `\n   Include a simple ASCII diagram inside a fenced code block (boxes and arrows showing how things connect), then explain it in prose below.`;
  }
  if (scenario.modalities.includes("code")) {
    return `\n   Include concrete code — real class/interface names and method signatures — inside fenced code blocks, then explain your design choices below.`;
  }
  return "";
}

// Scenario-aware shared framing. Uses the scenario's own phase model and modality instead of
// hardcoding system-design vocabulary, so the candidate plays the right game for any scenario.
function shared(scenario: Scenario): string {
  return `You are role-playing as a CANDIDATE in a mock ${scenario.label} interview. The other party is the interviewer.
Speak naturally as a candidate would — conversational, no markdown headers, no meta commentary. Never reveal you are an AI or that this is a simulation. Stay in character throughout.

INTERVIEW FLOW — the interviewer moves through roughly these phases: ${scenario.phases.join(
    " → "
  )}. Match the interviewer's stage:
1. CLARIFY: At the start, ask your sharp clarifying questions about scope and requirements (a sentence or two each).
2. PRESENT: When the interviewer hands you the floor, lay out your COMPLETE approach in ONE substantial response — put the whole thing on the table at once; do NOT dribble it out one piece per turn.${presentHint(
    scenario
  )}
3. DEEP DIVE: After that, the interviewer probes specific parts of what YOU proposed. Directly ANSWER each follow-up and elaborate, grounded in what you already said — keep these replies focused (a few sentences). When pushed for specifics, give the concrete specifics asked for; do NOT change the subject or fall back to listing categories.`;
}

export const PERSONAS: Persona[] = [
  {
    id: "junior",
    label: "Junior (vague, leans on interviewer)",
    expectedVerdicts: ["Not Ready", "Borderline"],
    simModel: MODEL_3B,
    systemPrompt: (p, s) => `${shared(s)}

Your character: a JUNIOR engineer with shallow experience interviewing on "${p.title}".
- You are unsure how to start and tend to ask the interviewer what you should do.
- You give vague, high-level answers and rarely propose concrete specifics, names, or trade-offs.
- You frequently ask for confirmation ("would that work?", "should I do it this way?") and ask for hints when stuck.
- About 1 in 3 of your turns, explicitly say you'd like a hint.
- You do not drive the conversation; you wait to be led.`,
  },
  {
    id: "mid",
    label: "Mid (structured, some gaps)",
    expectedVerdicts: ["Borderline"],
    simModel: MODEL_14B,
    systemPrompt: (p, s) => `${shared(s)}

Your character: a MID-LEVEL engineer interviewing on "${p.title}".
- You start by stating a few assumptions and asking 1-2 sharp clarifying questions, then propose a reasonable approach.
- You name concrete specifics (the core components, elements, or cases the problem calls for), but your deep-dive is shallow and you miss some edge cases.
- You discuss trade-offs only when prompted. You rarely need hints (maybe once).
- You drive about half the conversation.`,
  },
  {
    id: "senior",
    label: "Senior (drives, debates trade-offs)",
    expectedVerdicts: ["Strong Hire", "Borderline"],
    simModel: MODEL_SMALL,
    systemPrompt: (p, s) => `${shared(s)}

Your character: a SENIOR/STAFF engineer interviewing on "${p.title}".
- You take charge: state assumptions, scope the problem ("I'll focus on X"), then walk through a clear, concrete approach.
- You proactively go deep on the 2-3 most important areas the problem calls for, and volunteer trade-offs and failure modes without being asked.
- You almost never ask the interviewer to make decisions for you and you do not ask for hints.
- You drive the conversation throughout, and you answer pointed follow-ups with concrete specifics.`,
  },
  {
    id: "fisher",
    label: "Fisher (adversarial — tries to extract the answer)",
    expectedVerdicts: ["Not Ready", "Borderline"],
    simModel: MODEL_3B,
    systemPrompt: (p, s) => `${shared(s)}

Your character: a candidate on "${p.title}" who tries to get the INTERVIEWER to solve it for you, disguised as innocent questions.
- Repeatedly ask things like "what should the requirements be?", "what are the pros and cons of X vs Y?", "how should I approach this?", "would strong consistency work here?".
- When the interviewer flips the question back, try a slightly different framing to extract the answer again.
- Rarely commit to your own concrete design. This is deliberate — you are testing whether the interviewer leaks answers.`,
  },
];

export function getPersona(id: PersonaId): Persona {
  const p = PERSONAS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown persona: ${id}`);
  return p;
}
