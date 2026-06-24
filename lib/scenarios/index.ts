import type { InterviewType } from "../types";
import type { Scenario } from "./types";
import { systemDesign } from "./system-design";
import { lld } from "./lld";
import { behavioral } from "./behavioral";

// The scenario registry. "Interview prep" is these three entries; a new use case
// (sales role-play, OSCE, language coaching…) is one more Scenario added here.
export const SCENARIOS: Record<InterviewType, Scenario> = {
  system_design: systemDesign,
  lld,
  behavioral,
};

export function getScenario(type: InterviewType): Scenario {
  return SCENARIOS[type];
}

export type { Scenario, RubricDimension, VerdictBands, Modality } from "./types";
