import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getProblemById, getProblemsByType } from "@/lib/problems";
import { PERSONAS, type PersonaId } from "./personas";
import { runSimulation, type SimResult } from "./engine";
import type { InterviewLevel } from "@/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, "runs");

// CLI: tsx sim/run.ts [problemId] [turns] [personaId(s)] [level]
const problemIdArg = process.argv[2];
const turnsArg = process.argv[3] ? Number(process.argv[3]) : null;
// Accepts a single persona or a comma-separated list, e.g. "junior,mid"
const personaArg = process.argv[4];
const personaIds = personaArg
  ? (personaArg.split(",").map((s) => s.trim()) as PersonaId[])
  : null;
// Target level the candidate is scored against (default senior).
const level = (process.argv[5] as InterviewLevel) ?? "senior";

// Max-turn cap by interview type (the run ends earlier when the interviewer wraps up).
// System design needs the most room to traverse all phases + deep-dive.
const TURN_CAP: Record<string, number> = {
  system_design: 30,
  lld: 22,
  behavioral: 14,
};

const keys = {
  cerebras: process.env.CEREBRAS_API_KEY ?? null,
  groq: process.env.GROQ_API_KEY ?? null,
  mistral: process.env.MISTRAL_API_KEY ?? null,
  gemini: process.env.GEMINI_API_KEY ?? null,
};
if (!keys.cerebras && !keys.groq && !keys.mistral && !keys.gemini) {
  console.error(
    "\n✖ No provider key set. Set at least one of:\n" +
      "  CEREBRAS_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, GEMINI_API_KEY\n" +
      "  e.g.  MISTRAL_API_KEY=... npm run sim\n"
  );
  process.exit(1);
}

const problem = problemIdArg
  ? getProblemById(problemIdArg)
  : getProblemById("rate-limiter") ?? getProblemsByType("system_design")[0];

if (!problem) {
  console.error(`✖ Problem not found: ${problemIdArg ?? "(default)"}`);
  process.exit(1);
}

// Explicit arg wins; otherwise use the per-type cap.
const turns = turnsArg ?? TURN_CAP[problem.type] ?? 20;

const personas = personaIds
  ? PERSONAS.filter((p) => personaIds.includes(p.id))
  : PERSONAS;

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function verdictMatches(expected: string[], actual: string): string {
  return expected.includes(actual) ? "✓" : "✗ UNEXPECTED";
}

async function main() {
  mkdirSync(RUNS_DIR, { recursive: true });
  console.log(`\n▶ Simulating "${problem!.title}" (${problem!.type}, target: ${level}) — ${turns} turns/persona\n`);

  const results: SimResult[] = [];
  for (const persona of personas) {
    process.stdout.write(`  running ${persona.id}…\n`);

    // Stable filename so incremental snapshots and the final result write to one file.
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const file = join(RUNS_DIR, `${problem!.id}-${persona.id}-${ts}.json`);
    let lastSnapshot: SimResult | null = null;

    try {
      const result = await runSimulation(
        problem!,
        persona,
        turns,
        keys,
        (snapshot) => {
          // Persist each turn for the live UI + failure-survival. The engine prints the
          // live transcript itself, so we don't echo per-turn lines here.
          lastSnapshot = snapshot;
          writeFileSync(file, JSON.stringify(snapshot, null, 2));
        },
        level
      );
      results.push(result);
      writeFileSync(file, JSON.stringify(result, null, 2));
      console.log(`  ✓ ${persona.id} → ${result.evaluation?.verdict} (${result.evaluation?.total})`);
    } catch (e) {
      // Persist whatever we have so the transcript isn't lost on a mid-run failure.
      const msg = e instanceof Error ? e.message : String(e);
      if (lastSnapshot) {
        writeFileSync(
          file,
          JSON.stringify({ ...(lastSnapshot as SimResult), status: "failed", error: msg }, null, 2)
        );
      }
      console.log(`  ✗ ${persona.id} FAILED: ${msg}`);
    }
  }

  // ---- Report ----
  console.log("\n" + "═".repeat(96));
  console.log("PERSONA      VERDICT (raw→final)        TOTAL  HINTS  FISH  DROVE  PHASE          EXPECTED");
  console.log("─".repeat(96));
  for (const r of results) {
    const persona = PERSONAS.find((p) => p.id === r.persona)!;
    const ev = r.evaluation;
    if (!ev) continue;
    const v = ev.rawVerdict === ev.verdict ? ev.verdict : `${ev.rawVerdict}→${ev.verdict}`;
    console.log(
      `${r.persona.padEnd(12)} ${v.padEnd(26)} ${String(ev.total).padEnd(6)} ` +
        `${String(r.signals.hintsTaken).padEnd(6)} ${String(r.signals.fishingCount).padEnd(5)} ` +
        `${fmtPct(r.signals.contributionRatio).padEnd(6)} ${r.signals.maxPhaseLabel.padEnd(14)} ` +
        `${verdictMatches(persona.expectedVerdicts, ev.verdict)}`
    );
    if (ev.capReason) console.log(`             ↳ cap: ${ev.capReason}`);
    if (r.interviewerFlags.length) {
      console.log(`             ⚠ interviewer: ${r.interviewerFlags.join("; ")}`);
    }
  }
  console.log("═".repeat(96));
  console.log(`\nTranscripts + evaluations saved to sim/runs/\n`);
}

main();
