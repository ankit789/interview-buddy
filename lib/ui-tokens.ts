// Shared visual language for the "Calibrated" design system. One source of truth
// for difficulty / interview-type / verdict styling so every surface reads the same.

export const DIFFICULTY_TEXT: Record<string, string> = {
  Easy: "text-emerald-400",
  Medium: "text-amber-400",
  Hard: "text-rose-400",
};

export const DIFFICULTY_PILL: Record<string, string> = {
  Easy: "text-emerald-400 border-emerald-400/30",
  Medium: "text-amber-400 border-amber-400/30",
  Hard: "text-rose-400 border-rose-400/30",
};

export const TYPE_LABEL: Record<string, string> = {
  system_design: "SD",
  lld: "LLD",
  behavioral: "BEH",
  sdet_test_design: "TEST",
  sdet_framework_design: "FRMW",
};

export const TYPE_FULL: Record<string, string> = {
  system_design: "System Design",
  lld: "Low-Level Design",
  behavioral: "Behavioral",
  sdet_test_design: "SDET — Test Design",
  sdet_framework_design: "SDET — Framework Design",
};

export const VERDICT_PILL: Record<string, string> = {
  "Strong Hire": "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Borderline: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  "Not Ready": "text-rose-400 bg-rose-400/10 border-rose-400/20",
};
