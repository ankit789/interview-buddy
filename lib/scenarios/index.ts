import type { InterviewType } from "../types";
import type { Scenario } from "./types";
import { systemDesign } from "./system-design";
import { lld } from "./lld";
import { behavioral } from "./behavioral";
import { sdetTestDesign } from "./sdet-test-design";
import { sdetFrameworkDesign } from "./sdet-framework-design";

// The scenario registry. A new use case (sales role-play, OSCE, language coaching…)
// is one more Scenario added here plus its entry in the InterviewType union.
export const SCENARIOS: Record<InterviewType, Scenario> = {
  system_design: systemDesign,
  lld,
  behavioral,
  sdet_test_design: sdetTestDesign,
  sdet_framework_design: sdetFrameworkDesign,
};

export function getScenario(type: InterviewType): Scenario {
  return SCENARIOS[type];
}

export type { Scenario, RubricDimension, VerdictBands, Modality } from "./types";
