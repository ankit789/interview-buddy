import type { InterviewType, InterviewLevel, Problem } from "../types";

// Which input surfaces a scenario exposes. Interview prep uses voice/text/whiteboard/code;
// future scenarios (sales role-play, language coaching) would pick their own subset.
export type Modality = "voice" | "text" | "whiteboard" | "code";

// One scored dimension of the rubric. The JSON skeleton handed to the evaluator is
// generated from these, so adding a dimension is a one-line change.
export interface RubricDimension {
  letter: string;
  label: string;
}

// Maps a summed score to a verdict band. notReadyMax/borderlineMax are inclusive upper
// bounds; anything above borderlineMax up to maxTotal is "Strong Hire".
export interface VerdictBands {
  notReadyMax: number;
  borderlineMax: number;
  maxTotal: number;
}

// Context the evaluator intro may branch on (e.g. whether a diagram exists).
export interface EvaluatorContext {
  hasCanvas: boolean;
}

// A Scenario bundles everything that used to be scattered across per-type branches and
// Record<InterviewType, …> maps: the examiner persona, the phase model, the rubric, and
// the verdict bands. "Interview prep" is just the first three scenarios in the registry.
export interface Scenario {
  id: InterviewType;
  label: string;
  modalities: Modality[];

  // Phase model — names plus the keyword regex sets used to detect the current/max phase.
  // phaseSignals is index-aligned to phases.
  phases: string[];
  phaseSignals: RegExp[][];

  // The live interviewer system prompt for this scenario.
  buildPersona: (problem: Problem, level: InterviewLevel) => string;

  // Evaluation: dimensions + verdict thresholds + scenario-specific framing and scoring text.
  rubric: RubricDimension[];
  verdict: VerdictBands;
  buildEvaluatorIntro: (problem: Problem, ctx: EvaluatorContext) => string;
  scoringGuide: string;
}
