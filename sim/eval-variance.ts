// Measures evaluator noise: re-runs the SAME transcript through the evaluator N times and
// reports the spread of totals + verdict agreement. Run:
//   MISTRAL_API_KEY=… npx tsx sim/eval-variance.ts <run-file.json> [N]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { buildEvaluationPrompt } from "@/lib/prompts";
import { complete } from "@/lib/llm";
import { getProblemById } from "@/lib/problems";
import type { SimResult } from "./engine";
import type { InterviewLevel } from "@/lib/types";

const RUNS_DIR = join(dirname(fileURLToPath(import.meta.url)), "runs");
const arg = process.argv[2];
const N = Number(process.argv[3] ?? 5);
const level = (process.argv[4] as InterviewLevel) ?? "senior";
if (!arg) {
  console.error("usage: npx tsx sim/eval-variance.ts <run-file.json|stem> [N]");
  process.exit(1);
}
const file = arg.endsWith(".json") ? arg : join(RUNS_DIR, `${arg}.json`);

const keys = {
  mistral: process.env.MISTRAL_API_KEY ?? null,
  cerebras: process.env.CEREBRAS_API_KEY ?? null,
  groq: process.env.GROQ_API_KEY ?? null,
  gemini: process.env.GEMINI_API_KEY ?? null,
};

async function main() {
  const run = JSON.parse(readFileSync(file, "utf8")) as SimResult;
  const problem = getProblemById(run.problemId);
  if (!problem) throw new Error(`unknown problem ${run.problemId}`);

  const transcript = run.transcript
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");
  const prompt = buildEvaluationPrompt(problem, problem.type, transcript, false, run.signals, level);

  console.log(`\nRe-evaluating ${run.persona} on "${problem.title}" against the ${level} bar — ${N} runs\n`);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function evalOnce(): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const { text } = await complete(keys, [{ role: "user", content: prompt }], {
          json: true,
          maxTokens: 4000,
          temperature: 0.3,
        });
        return text;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/429|quota|rate.?limit/i.test(msg) && attempt < 5) {
          await sleep(62000);
          continue;
        }
        throw e;
      }
    }
    throw new Error("retries exhausted");
  }

  const totals: number[] = [];
  const verdicts: string[] = [];
  for (let i = 0; i < N; i++) {
    const text = await evalOnce();
    const m = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : text);
    totals.push(parsed.total ?? 0);
    verdicts.push(parsed.verdict ?? "?");
    console.log(`  run ${i + 1}: ${parsed.total}/14  ${parsed.verdict}`);
    await sleep(1500); // pace under Mistral's burst limit
  }

  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length);
  const dist = verdicts.reduce<Record<string, number>>((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});
  console.log(
    `\n  total: min ${Math.min(...totals)}  max ${Math.max(...totals)}  mean ${mean.toFixed(
      1
    )}  sd ${sd.toFixed(2)}`
  );
  console.log(`  verdicts: ${JSON.stringify(dist)}`);
  const agreement = Math.max(...Object.values(dist)) / N;
  console.log(`  verdict agreement: ${Math.round(agreement * 100)}%\n`);
}

main();
