import type { InterviewLevel } from "../types";
import type { Scenario } from "./types";
import { antiSolveRule, interviewerLevelContext, renderPhases } from "./shared";

// SDET-specific L4/L5/L6 calibration. The shared default talks about "multi-region /
// graceful degradation" — wrong vocabulary for a test-design round, where seniority shows
// up as coverage strategy, framework ownership, and org-level quality direction.
const sdetLevelExpectations = (level: InterviewLevel): string => {
  switch (level) {
    case "mid":
      return `Bar for Mid-level (L4): solid functional plus obvious negative/boundary cases for the feature in front of them, using an existing framework. Catches the common edge cases and would write clean automation for assigned scenarios. Broad strategy, non-functional testing, and CI ownership are a bonus, not required.`;
    case "senior":
      return `Bar for Senior (L5): owns the test strategy for a feature/service end to end — systematically derives cases (equivalence partitioning, boundary, state-transition), reasons across the test pyramid, designs or extends automation frameworks, and proactively raises non-functional risks (performance, security) and flakiness/CI concerns. A correct-but-shallow "list of test cases" is only Borderline here.`;
    case "staff":
      return `Bar for Staff (L6): everything expected of Senior, PLUS quality strategy at scale — sets the testing approach across teams, makes build-vs-buy tooling calls, defines quality gates and metrics (coverage, escape rate, MTTR), and drives testability as a design constraint and shift-left culture. A strong service-level answer only MEETS the bar; Strong Hire requires org-level judgment and test-architecture depth.`;
  }
};

export const sdetTestDesign: Scenario = {
  id: "sdet_test_design",
  label: "SDET — Test Design & Strategy",
  modalities: ["voice", "text", "whiteboard"],

  phases: [
    "Scope & Requirements",
    "Strategy & Test Levels",
    "Test Cases",
    "Automation & Tooling",
    "Non-Functional & Quality Gates",
  ],

  // Keyword signals per phase — ordered later-to-earlier so the highest active phase wins.
  phaseSignals: [
    // 0 — Scope & Requirements
    [/scope|requirement|clarif|assumption|in scope|out of scope|use case|persona|what (does|should) (it|the)/i],
    // 1 — Strategy & Test Levels
    [/strateg|test level|unit test|integration|end.to.end|e2e|smoke|sanity|regression|exploratory|test pyramid|prioriti|risk.based|coverage strateg/i],
    // 2 — Test Cases
    [/test case|positive|negative case|boundary|equivalence|partition|invalid|valid input|expected (result|output)|assert|happy path|edge case|decision table/i],
    // 3 — Automation & Tooling
    [/automat|framework|selenium|playwright|cypress|appium|page object|fixture|mock|stub|rest.assured|contract test|pact|data.driven|keyword.driven|parall|flak/i],
    // 4 — Non-Functional & Quality Gates
    [/performance|load test|stress test|jmeter|\bk6\b|gatling|security test|owasp|penetration|accessibilit|a11y|reliab|chaos|quality gate|ci\/cd|pipeline|escape rate|monitor|observability/i],
  ],

  buildPersona: (problem, level) =>
    `You are a senior SDET / test architect at a top-tier tech company conducting a test design and strategy interview. You are evaluating how a candidate thinks about testing a system — coverage, edge cases, automation, and quality strategy.

The thing to test is: "${problem.title}"
${problem.statement}

${renderPhases(sdetTestDesign.phases)}
${antiSolveRule}
${interviewerLevelContext(level, sdetLevelExpectations)}

Your behaviour rules:
- Start by stating in ONE sentence what the candidate should test and inviting them to begin (e.g. "How would you test a ride-sharing surge-pricing service? Start by telling me how you'd scope it."). Do NOT enumerate test categories, dimensions, or example cases — those are for the candidate to produce.
- Push for CONCRETE test cases, not category names: "Give me the actual inputs and the expected result", "What's the boundary value there?", "What exactly would you assert?"
- Steer through the space toward whatever they neglect: scope → strategy & test levels (the pyramid) → concrete cases (positive, negative, boundary) → automation approach & tooling → non-functional (perf/security/a11y) and quality gates (CI).
- When they propose automation, push on framework design and trade-offs: "What would you deliberately NOT automate, and why?", "How do you keep that test from getting flaky?"
- Ask exactly ONE question per turn. Keep responses to 1-3 sentences. The candidate should be doing most of the talking.
- Reward proactive coverage and risk-based prioritization; a candidate who only lists happy-path cases, or names categories without concrete cases, is weak.
- Never break character. Never say you are an AI.

Tone: pragmatic and quality-obsessed, a little adversarial about edge cases — like an SDET who has watched production break in surprising ways.`,

  // The TESTED framework — 7 dimensions, scored 0-3 (max 21).
  rubric: [
    { letter: "T", label: "Test Scope & Requirements" },
    { letter: "E", label: "Edge, Boundary & Negative Cases" },
    { letter: "S", label: "Strategy & Coverage Levels" },
    { letter: "T2", label: "Tooling & Automation Framework" },
    { letter: "E2", label: "Efficiency: CI/CD & Quality Gates" },
    { letter: "N", label: "Non-Functional (Perf/Security/A11y)" },
    { letter: "D", label: "Depth / Debugging & RCA" },
  ],
  verdict: { notReadyMax: 9, borderlineMax: 15, maxTotal: 21 },

  buildEvaluatorIntro: (problem, ctx) =>
    `You are a senior SDET / test architect evaluating a test design and strategy interview. Score the candidate on the TESTED framework.

What was to be tested: "${problem.title}"
${problem.statement}

${ctx.hasCanvas ? "The candidate may have sketched a test matrix or decision table on the whiteboard, summarized in a \"[CANDIDATE'S WHITEBOARD DIAGRAM]\" section below — factor it into coverage and case-design scoring.\n" : ""}Judge how a strong SDET would: breadth of coverage across test levels, rigor on edge/negative/boundary cases, soundness of the automation approach and tooling trade-offs, non-functional awareness, and quality-gate/CI thinking. Concrete cases and trade-offs are strong evidence; naming categories without concrete cases is a gap.`,

  scoringGuide: `Scoring guide (0-3 per dimension):
  0 = not addressed at all
  1 = addressed only after the interviewer asked, OR named a category without concrete cases/specifics
  2 = SOLID (meets the bar): the candidate PROACTIVELY raised this AND gave concrete, correct specifics (real test cases, a sound automation choice, a named non-functional concern)
  3 = EXCEPTIONAL (exceeds the bar): proactive AND deep — risk-based prioritization, failure-injection thinking, framework/tooling trade-offs, or quality-strategy insight beyond a thorough answer
  IMPORTANT: A score of 2 requires the candidate to have raised the topic independently. Reserve 3 for genuinely standout rigor — do NOT give a 3 for a complete-but-ordinary answer.`,

  levelExpectations: sdetLevelExpectations,
};
