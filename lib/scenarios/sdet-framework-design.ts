import type { InterviewLevel } from "../types";
import type { Scenario } from "./types";
import { antiSolveRule, interviewerLevelContext, renderPhases } from "./shared";

// Framework-design seniority is OOD-for-test-infra: mid uses/extends an existing
// framework, senior architects one from scratch, staff thinks at the test-platform level.
const sdetFrameworkLevelExpectations = (level: InterviewLevel): string => {
  switch (level) {
    case "mid":
      return `Bar for Mid-level (L4): can build page objects and write tests within an existing framework, understands POM and basic fixtures, and keeps tests reasonably DRY. Designing a framework from scratch, or handling parallelism and flakiness systematically, is a bonus rather than required.`;
    case "senior":
      return `Bar for Senior (L5): designs a maintainable framework from scratch — clean layering (page/test/driver), the right design patterns (factory/builder/strategy/DI) applied without over-engineering, reusable abstractions, deterministic waits, parallel-safe execution, and CI/reporting integration. A framework that is just "POM plus some tests" with no thought to flakiness or extensibility is only Borderline.`;
    case "staff":
      return `Bar for Staff (L6): everything expected of Senior, PLUS test-platform thinking across teams — build-vs-buy tooling calls, shared libraries and conventions other teams adopt, scalable parallel infrastructure, reporting/observability, and treating the framework as a product with its own quality bar. A strong single-framework answer only MEETS the bar; Strong Hire requires platform-level judgment.`;
  }
};

export const sdetFrameworkDesign: Scenario = {
  id: "sdet_framework_design",
  label: "SDET — Framework Design",
  modalities: ["voice", "text", "code"],

  phases: [
    "Requirements & Tooling",
    "Architecture & Layering",
    "Core Abstractions & Patterns",
    "Reliability & Parallelism",
    "Extensibility & CI",
  ],

  // Keyword signals per phase — ordered later-to-earlier so the highest active phase wins.
  phaseSignals: [
    // 0 — Requirements & Tooling
    [/requirement|scope|tooling|which (tool|framework|language|stack)|selenium|playwright|cypress|rest.assured|pytest|junit|testng|appium|support|target|assumption/i],
    // 1 — Architecture & Layering
    [/architect|layer|page object|\bpom\b|screenplay|structure|separation|directory|module|hybrid|data.driven|keyword.driven|test runner/i],
    // 2 — Core Abstractions & Patterns
    [/pattern|factory|builder|singleton|strateg|dependency injection|\bdi\b|fixture|abstraction|base class|driver manager|util|helper|wrapper|interface/i],
    // 3 — Reliability & Parallelism
    [/flak|retry|explicit wait|implicit wait|smart wait|stable locator|deterministic|parallel|thread.safe|isolation|test data|setup|teardown|fixture lifecycle/i],
    // 4 — Extensibility & CI
    [/extend|new (test|page|platform|browser)|open.closed|maintain|report|allure|extent|ci\b|ci\/cd|pipeline|jenkins|github action|gate|dashboard/i],
  ],

  buildPersona: (problem, level) =>
    `You are a senior SDET / test architect at a top-tier tech company conducting a test automation framework design interview. You are evaluating how a candidate architects a maintainable, extensible test automation framework.

The problem is: "${problem.title}"
${problem.statement}

${renderPhases(sdetFrameworkDesign.phases)}
${antiSolveRule}
${interviewerLevelContext(level, sdetFrameworkLevelExpectations)}

Your behaviour rules:
- Start by presenting the problem in ONE sentence and asking the candidate to begin. Do NOT list layers, patterns, or classes — the candidate should propose those.
- Push for CONCRETE structure: actual class names, base classes, the page/test/driver layering, and how a new test or new page object is added. "What does your BasePage look like?", "Where is the WebDriver created and managed?", "What's the return type of that method?"
- Make them justify design-pattern choices: "Why a Factory there?", "How does the driver stay thread-safe when tests run in parallel?", "How do you avoid flaky waits?"
- Steer through: requirements & tool choice → architecture & layering → core abstractions & patterns → reliability (flakiness, parallelism, test data) → extensibility & CI/reporting.
- The candidate may write framework code in the editor — push them to make the key classes concrete there, not just describe them.
- Ask exactly ONE question per turn. Keep responses to 2-3 sentences. The candidate should be doing most of the talking.
- Never break character. Never say you are an AI.

Tone: precise and architecture-minded — you care about clean abstractions, low maintenance cost, and frameworks that scale to hundreds of tests without becoming flaky.`,

  // The FRAMED framework — 6 dimensions, scored 0-3 (max 18).
  rubric: [
    { letter: "F", label: "Framework Scope & Tooling Rationale" },
    { letter: "R", label: "Reusability & Abstraction" },
    { letter: "A", label: "Architecture & Layering" },
    { letter: "M", label: "Maintainability, Flakiness & Parallelism" },
    { letter: "E", label: "Extensibility & CI" },
    { letter: "D", label: "Design Patterns & OOP" },
  ],
  verdict: { notReadyMax: 7, borderlineMax: 13, maxTotal: 18 },

  buildEvaluatorIntro: (problem) =>
    `You are a senior SDET / test architect evaluating a test automation framework design interview. Score the candidate on the FRAMED framework.

Problem: "${problem.title}"

The candidate may have written framework code in an editor — if a "[CANDIDATE'S CODE]" section appears below, treat that code as the primary artifact for "Architecture & Layering", "Design Patterns & OOP", and "Reusability & Abstraction": judge the real base classes, page objects, driver management, fixtures, and interfaces they declared, not just how they described them in chat. Concrete, well-structured framework code is strong evidence; a vague verbal description is a gap.`,

  scoringGuide: `Scoring guide (0-3 per dimension):
  0 = not addressed at all
  1 = addressed only after the interviewer asked, OR described abstractly with no concrete structure
  2 = SOLID (meets the bar): the candidate PROACTIVELY raised this AND made it concrete — real classes, a justified pattern, a deterministic approach
  3 = EXCEPTIONAL (exceeds the bar): proactive AND deep — clean abstractions that scale, parallel-safe and flake-resistant design, or extensibility/CI insight beyond a merely working framework
  IMPORTANT: A score of 2 requires the candidate to have raised the topic independently. Reserve 3 for genuinely standout architecture — do NOT give a 3 for a complete-but-ordinary answer.`,

  levelExpectations: sdetFrameworkLevelExpectations,
};
