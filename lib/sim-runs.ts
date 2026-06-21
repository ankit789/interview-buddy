import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { SimResult } from "@/sim/engine";

const RUNS_DIR = join(process.cwd(), "sim", "runs");
const ID_RE = /^[a-zA-Z0-9._-]+$/;

export type SimRun = SimResult;

export interface SimRunSummary {
  id: string;
  problemId: string;
  problemTitle: string;
  persona: string;
  status: string;
  verdict: string;
  total: number;
  hints: number;
  fishing: number;
  contributionPct: number;
  mtime: number;
}

async function readRunFile(file: string): Promise<SimRun | null> {
  try {
    const raw = await readFile(join(RUNS_DIR, file), "utf8");
    return JSON.parse(raw) as SimRun;
  } catch {
    return null;
  }
}

export async function listSimRuns(): Promise<SimRunSummary[]> {
  let files: string[];
  try {
    files = (await readdir(RUNS_DIR)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const summaries = await Promise.all(
    files.map(async (file): Promise<SimRunSummary | null> => {
      const run = await readRunFile(file);
      if (!run) return null;
      const { mtimeMs } = await stat(join(RUNS_DIR, file));
      return {
        id: file.replace(/\.json$/, ""),
        problemId: run.problemId,
        problemTitle: run.problemTitle,
        persona: run.persona,
        status: run.status ?? "completed",
        verdict: run.evaluation?.verdict ?? "—",
        total: run.evaluation?.total ?? 0,
        hints: run.signals?.hintsTaken ?? 0,
        fishing: run.signals?.fishingCount ?? 0,
        contributionPct: Math.round((run.signals?.contributionRatio ?? 0) * 100),
        mtime: mtimeMs,
      };
    })
  );

  return summaries
    .filter((s): s is SimRunSummary => s !== null)
    .sort((a, b) => b.mtime - a.mtime);
}

export async function getSimRun(id: string): Promise<SimRun | null> {
  // Guard against path traversal — id must be a plain filename stem.
  if (!ID_RE.test(id)) return null;
  return readRunFile(`${id}.json`);
}
